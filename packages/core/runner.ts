export const RUN_PIN_SH_V2 = `#!/system/bin/sh
APP=$1; LAT=$2; LNG=$3; Q=$4; QE=$5; SCAN=$6; PIN=$7; TRACK_AI=\${8:-0}
RT=/data/local/tmp/rt
D=$RT/\${SCAN}_\${PIN}
REC_SECS=45
MAX_STOPS=8
case $APP in
 maps)   PKG=com.google.android.apps.maps ;;
 google) PKG=com.google.android.googlequicksearchbox ;;
 chrome) PKG=com.android.chrome ;;
 *) echo "unknown app $APP"; exit 2 ;;
esac
mkdir -p "$D"; rm -f "$D"/*
S=$(wm size | tail -n1 | sed 's/.*: //'); W=\${S%x*}; H=\${S#*x}; X=$((W/2))
T0=$(date +%s)
{
 echo "app=$APP"; echo "lat=$LAT"; echo "lng=$LNG"; echo "query=$Q"
 echo "scan=$SCAN"; echo "pin=$PIN"; echo "track_ai=$TRACK_AI"
 echo "screen=\${W}x\${H}"; echo "t_start=$T0"
} > "$D/meta.txt"
dump() {
 DuoPlusDumpUI "$1" >/dev/null 2>&1 && [ -s "$1" ] && return 0
 uiautomator dump "$1" >/dev/null 2>&1
}
h() {
 [ -s "$1" ] || { echo "empty_$RANDOM"; return; }
 sed 's/><node/>\\n<node/g' "$1" \\
   | grep -v 'package="com.android.systemui"' \\
   | grep -oE '(text|content-desc)="[^"]+"' \\
   | md5sum | cut -d' ' -f1
}
tap_in_file() {
 B=$(sed 's/><node/>\\n<node/g' "$2" \\
     | grep -iE "(text|content-desc)=\\"[^\\"]*$1[^\\"]*\\"" \\
     | head -n1 \\
     | sed -n 's/.*bounds="\\[\\([0-9]*\\),\\([0-9]*\\)\\]\\[\\([0-9]*\\),\\([0-9]*\\)\\]".*/\\1 \\2 \\3 \\4/p')
 [ -z "$B" ] && return 1
 set -- $B
 input tap $(( ($1+$3)/2 )) $(( ($2+$4)/2 ))
}
dismiss_fre() {
 r=0
 while [ $r -lt 4 ]; do
   dump "$RT/fre.xml"; hit=0
   for t in "Accept" "Skip" "No thanks" "Not now" "Got it" "Continue"; do
     if tap_in_file "$t" "$RT/fre.xml"; then hit=1; sleep 1.5; break; fi
   done
   [ $hit -eq 0 ] && return 0
   r=$((r+1))
 done
}
am force-stop $PKG
pm clear $PKG >/dev/null 2>&1
pm grant $PKG android.permission.ACCESS_FINE_LOCATION 2>/dev/null
pm grant $PKG android.permission.ACCESS_COARSE_LOCATION 2>/dev/null
if [ "$APP" != chrome ]; then
 monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
 sleep 4
 dismiss_fre
fi
screenrecord --time-limit $REC_SECS --bit-rate 1500000 "$D/video.mp4" >/dev/null 2>&1 &
REC_PID=$!
sleep 1
case $APP in
 maps)   am start -a android.intent.action.VIEW -d "geo:$LAT,$LNG?q=$QE&z=15" $PKG ;;
 google) am start -a android.intent.action.WEB_SEARCH --es query "$Q" $PKG ;;
 chrome) am start -a android.intent.action.VIEW -d "https://www.google.com/search?q=$QE" $PKG ;;
esac >/dev/null 2>&1
prev=""; n=0
while [ $n -lt 7 ]; do
 sleep 2; dump "$D/probe.xml"; cur=$(h "$D/probe.xml")
 [ -n "$cur" ] && [ "$cur" = "$prev" ] && break
 prev=$cur; n=$((n+1))
done
if [ "$TRACK_AI" = "1" ]; then
 cp "$D/probe.xml" "$D/aio_initial.xml" 2>/dev/null
 if [ "$APP" = "chrome" ] || [ "$APP" = "google" ]; then
   if grep -qiE "AI Overview|Generative AI|Show more" "$D/aio_initial.xml" 2>/dev/null; then
     if tap_in_file "Show more" "$D/aio_initial.xml"; then
       sleep 2.2
       dump "$D/aio_expanded.xml"
     fi
   fi
 elif [ "$APP" = "maps" ]; then
   if grep -qiE "Ask Maps|Know before you go|AI-organized" "$D/aio_initial.xml" 2>/dev/null; then
     cp "$D/aio_initial.xml" "$D/aio_expanded.xml"
   fi
 fi
fi
if [ "$APP" = maps ]; then
 input swipe $X $((H*62/100)) $X $((H*12/100)) 350; sleep 1.8
fi
prev=""; i=0
while [ $i -lt $MAX_STOPS ]; do
 dump "$D/dump_$i.xml"; cur=$(h "$D/dump_$i.xml")
 if [ "$i" -gt 0 ] && [ "$cur" = "$prev" ]; then
   rm -f "$D/dump_$i.xml"
   break
 fi
 prev=$cur
 input swipe $X $((H*78/100)) $X $((H*25/100)) 400; sleep 1.6
 i=$((i+1))
done
echo "stops=$i" >> "$D/meta.txt"
grep -l -i -E "unusual traffic|not a robot" "$D"/dump_*.xml > "$D/flags.txt" 2>/dev/null
if [ "$APP" = maps ] && ls "$D"/dump_[1-9].xml >/dev/null 2>&1; then
 grep -l -i "Search this area" "$D"/dump_[1-9].xml >> "$D/flags.txt" 2>/dev/null
fi
rm -f "$D/probe.xml" "$RT/fre.xml"
wait "$REC_PID" || exit 1
[ -s "$D/video.mp4" ] || exit 1
echo "t_end=$(date +%s)" >> "$D/meta.txt"
tar -czf "$RT/\${SCAN}_\${PIN}.tar.gz" -C "$RT" "\${SCAN}_\${PIN}"
if [ -n "$UPLOAD_URL" ]; then
 if curl --max-time 90 --retry 2 -H "Content-Type: application/gzip" -sS -f -T "$RT/\${SCAN}_\${PIN}.tar.gz" "$UPLOAD_URL"; then
   rm -f "$RT/\${SCAN}_\${PIN}.tar.gz"; rm -rf "$D"; exit 0
 fi
 echo upload_failed > "$D/status"; exit 1
fi
echo done > "$D/status"
`;

export function shellQuote(value: string) {
  return "'" + value.replaceAll("'", "'\\''") + "'";
}
