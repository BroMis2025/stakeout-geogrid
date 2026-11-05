import urllib.request as http,urllib.error as errors,json,uuid,sys,os
if os.environ.get('TEST_DISPOSABLE_DB') != 'yes': raise SystemExit('Set TEST_DISPOSABLE_DB=yes for an isolated test instance.')
base=os.environ.get('TEST_APP_URL','http://127.0.0.1:3315').rstrip('/'); count=0; prefix=uuid.uuid4().hex[:12]
def request(method,path,want,body=None,cookie=None,key=None):
 global count
 headers={'Content-Type':'application/json'}
 if cookie:headers['Cookie']=cookie
 if key:headers['Idempotency-Key']=key
 rq=http.Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=method)
 try:r=http.urlopen(rq,timeout=40)
 except errors.HTTPError as e:r=e
 text=r.read().decode();assert r.status==want,(path,r.status,want,text[:200]);count+=1
 return (json.loads(text) if r.headers.get('content-type','').startswith('application/json') else text,r.headers)
def signup(tag):
 d,h=request('POST','/api/auth/login',200,{'email':prefix+tag+'@example.test','mode':'register','password':'demo-qa-password'})
 assert d['user']['creditBalance']==150 and d['user']['role']=='AGENCY'
 return h['set-cookie'].split(';')[0]
for path in ['/','/login']:request('GET',path,200)
request('GET','/api/health/neon',200);request('GET','/api/user/me',401)
a=signup('a');b=signup('b')
request('POST','/api/auth/login',401,{'email':prefix+'a@example.test','password':'some-wrong-pass'})
request('GET','/api/user/me',401,cookie=a+'x')
request('GET','/api/admin/devices',403,cookie=a)
request('GET','/admin/devices',403,cookie=a)
spec={'keyword':'emergency plumber','targetBusiness':'Test Plumbing','centerLat':28.039465,'centerLng':-81.949804,'gridSize':3,'trackAiOverviews':True,'scheduleType':'daily'}
run,_=request('POST','/api/scans/create',202,spec,a,'same-key-first');ident=run['scanId'];assert run['creditsCharged']==18
again,_=request('POST','/api/scans/create',202,spec,a,'same-key-first');assert again['scanId']==ident
me,_=request('GET','/api/user/me',200,cookie=a);assert me['creditBalance']==132
request('POST','/api/scans/create',402,{**spec,'gridSize':11},a,'overbudget-request')
details,_=request('GET','/api/scans/'+ident,200,cookie=a);assert len(details['pins'])==9
request('GET','/api/scans/'+ident,404,cookie=b);request('GET','/api/scans/compare?public=1&a='+ident+'&b='+ident,404)
request('GET','/api/share/'+ident,404);request('POST','/api/scans/'+ident,404,{'action':'share'},b)
d,_=request('POST','/api/scans/'+ident,200,{'action':'share'},a);link=d['path'];request('GET',link,200)
shared,_=request('GET','/api'+link,200);assert 'userId' not in shared
request('POST','/api/scans/'+ident,200,{'action':'revoke'},a);request('GET','/api'+link,404)
request('POST','/api/scans/'+ident,200,{'action':'pause'},a)
request('POST','/api/scans/'+ident,200,{'action':'resume'},a)
teaser,_=request('POST','/api/leads/teaser',202,{'email':prefix+'lead@example.test','keyword':'plumber','targetBusiness':'Example','lat':28.04,'lng':-81.95})
free,_=request('GET','/api'+teaser['reportPath'],200);assert len(free['pins'])==9 and free['trackAiOverviews']==False
request('GET','/api/scans',401)
request('POST','/api/auth/logout',200,{},a)
print('Passed',count,'HTTP checks, including registration, duplicate scan, insufficient credit, tenant isolation, role guard, sharing/revocation, scheduling controls, and a public 3x3 teaser.',flush=True)
