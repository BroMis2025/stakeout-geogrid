"""Isolated, opt-in browser measurement for Google desktop AI Mode."""
import json
import os
import sys
import time
import tarfile
from pathlib import Path
from urllib.parse import urlencode, urlparse
from cloakbrowser import launch

def capture(folder):
    spec = json.loads((folder / "request.json").read_text())
    proxy = os.environ.get("DESKTOP_PROXY_URL")
    if not proxy:
        raise RuntimeError("DESKTOP_PROXY_REQUIRED")
    browser = launch(headless=True, proxy=proxy)
    try:
        context = browser.new_context(geolocation={"latitude": spec["lat"], "longitude": spec["lng"]},
                                      permissions=["geolocation"], locale="en-US",
                                      viewport={"width": 1365, "height": 768}, record_video_dir=str(folder))
        page = context.new_page()
        url = "https://www.google.com/search?" + urlencode({"q":spec["keyword"],"udm":"50","hl":"en","gl":"us"})
        page.goto(url, wait_until="domcontentloaded", timeout=45000)
        selector = os.environ.get("DESKTOP_ANSWER_SELECTOR") or '[data-attrid="wa:/description"],[data-container-id="main-col"] [data-sfc-child],div[jsname="yEVEwb"]'
        answer = page.locator(selector).first
        answer.wait_for(state="visible", timeout=30000)
        # Give streamed text time to stabilize before recording the result.
        previous = ""
        for _ in range(12):
            body = answer.inner_text().strip()
            if body and body == previous:
                break
            previous = body
            page.wait_for_timeout(1000)
        if not body or "unusual traffic" in page.locator("body").inner_text().lower():
            raise RuntimeError("DESKTOP_ANSWER_UNAVAILABLE")
        # Only source links inside the identified answer container are attributed.
        urls = answer.locator("a[href]").evaluate_all("(links) => links.map(a => a.href)")
        citations = sorted({urlparse(u).hostname for u in urls if urlparse(u).scheme in ("http","https") and urlparse(u).hostname
                            and urlparse(u).hostname != 'google.com' and not urlparse(u).hostname.endswith('.google.com')})
        names = []
        for title in answer.locator('[data-attrid="title"],[data-place-id] [role="heading"]').all_inner_texts():
            title = title.strip()
            if title and title.casefold() not in [s.casefold() for s in names]:
                names.append(title)
        names = names[:20]
        page.screenshot(path=str(folder / "screen.png"))
        (folder / "answer.html").write_text(answer.inner_html())
        (folder / "result.json").write_text(json.dumps({"orderedBusinesses":names,"aiOverviewText":body[:16000],"aiCitations":citations}))
        video = page.video
        context.close()
        video.save_as(str(folder / "proof.webm"))
        with tarfile.open(folder / "raw.tar.gz","w:gz") as out:
            for name in ["screen.png","answer.html","result.json"]:
                out.add(folder / name,arcname=name)
    finally:
        browser.close()

if __name__ == "__main__":
    capture(Path(sys.argv[1]))
