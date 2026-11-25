// RECV: play notes into Sonomika Patch.
// When RECV is on, incoming MIDI notes go to the current patch (PATCH.noteIn(midi, velocity 0..1)),
// and patches that have their own melody let yours replace it.
// Notes arrive from the Ableton device (Max for Live, via window.max) or, in a normal browser, from any MIDI input (Web MIDI).
(() => {
  let on = false, midi = null, fillRef = null;   // RECV always starts off on a reload; you switch it on (inside Ableton it switches itself on)
  window.SONO_RECV = on;

  const paint = () => {
    const b = document.getElementById('recvb');
    if (!b) return;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
    if (fillRef) fillRef();   // the "Notes play" menu only shows while RECV is on
  };
  const set = v => {
    on = !!v;
    window.SONO_RECV = on;
    try { localStorage.setItem('sp-receive', on ? '1' : '0'); } catch (e) {}
    paint();
    if (on) webMidi();
  };

  // which voice of the patch the notes play: one of PATCH.voices, or 'ch' = by MIDI channel (1 = first voice, 2 = second, ...)
  const cur = () => (typeof PATCH !== 'undefined' ? PATCH : null);
  const key = () => 'sp-receive-to-' + ((cur() && cur().id) || '');
  const getTo = () => { let v = ''; try { v = localStorage.getItem(key()) || ''; } catch (e) {} return v || ((cur() && cur().recvDefault) || ''); };
  const voiceFor = ch => {
    const P = cur(), vs = (P && P.voices) || [];
    if (!vs.length) return undefined;
    const to = getTo();
    if (to === 'ch' || ((window.max || window.SONO_BRIDGE) && P.recvDefault === 'ch')) return vs[Math.min(vs.length, Math.max(1, ch || 1)) - 1].id;   // channels past the patch's last voice play its last voice
    return vs.some(x => x.id === to) ? to : vs[0].id;
  };
  const noteIn = (m, v, ch) => {
    if (!on) return;
    if (!(v > 0)) { const P = cur(); if (P && P.noteOff) P.noteOff(m, voiceFor(ch), ch || 1); return; }   // note-off: only patches that want it (most let sounds ring out)
    if (!window.__sonoAudioUp) { window.__sonoAudioUp = 1; try { initAudio(); ctx.resume(); } catch (e) {} }   // once is enough
    const P = cur();
    if (P && P.noteIn) P.noteIn(m, Math.min(1, v / 127), voiceFor(ch), ch || 1);
  };
  window.sonoNoteIn = noteIn;
  window.sonoReceive = set;

  // inside Ableton: the device sends "note <pitch> <velocity>" and "receive 0|1"
  // window.max can appear a moment after the page starts, so wait for it (up to 10 s)
  // inside Ableton: the picture fills the window (double-click or Esc to show the app around it again)
  const fullView = () => {
    if (document.getElementById('sonoMaxStyle')) return;
    const st = document.createElement('style');
    st.id = 'sonoMaxStyle';
    st.textContent = 'body.sono-full .flock-monitor{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;margin:0!important;z-index:2147483000;background:#000;border:0!important;padding:0!important;transform:none!important}' +
      'body.sono-full .flock-monitor canvas{width:100%!important;height:100%!important;object-fit:contain}' +
      'body.sono-full{visibility:hidden;overflow:hidden}body.sono-full .flock-monitor{visibility:visible}';   // nothing else is painted: the page stays light
    document.head.append(st);
    document.body.classList.add('sono-full');
    const flip = () => document.body.classList.toggle('sono-full');
    addEventListener('dblclick', flip);
    addEventListener('keydown', e => { if (e.key === 'Escape') flip(); });
  };
  const initMax = () => {
    if (document.body) fullView(); else addEventListener('DOMContentLoaded', fullView);
    window.max.bindInlet('note', (m, v, ch) => noteIn(+m, +v, +ch || 1));
    window.max.bindInlet('receive', x => set(+x));
    set(true);   // inside Ableton the device is there to receive: on from the start
    // the sound in Ableton, as three bands (low, mid, high, 0..1), about 30 times a second
    window.max.bindInlet('audio', (l, m, h) => { window.SONO_AUDIO = { l: +l || 0, m: +m || 0, h: +h || 0, t: performance.now() }; });
    // the device's patch menu: send it the list of patches and which one is open; "pick n" opens patch n (1 = the first)
    const list = () => (typeof PATCHES !== 'undefined' ? PATCHES : []);
    const sendList = () => {
      const L = list(), P = cur();
      if (!L.length || !window.max.outlet) return;
      window.max.outlet('clear');
      L.forEach(x => window.max.outlet('item', ((x.num ? x.num + ' ' : '') + (x.title || x.id)).trim()));
      const i = P ? L.findIndex(x => x.id === P.id) : -1;
      if (i >= 0) window.max.outlet('current', i);
    };
    window.max.bindInlet('pick', n => {
      const L = list(), x = L[(+n) - 1], P = cur();
      if (!x || (P && P.id === x.id)) return;
      const u = new URL(location.href);
      u.searchParams.set('patch', x.id);
      location.href = u.toString();
    });
    if (document.readyState === 'complete') setTimeout(sendList, 300); else addEventListener('load', () => setTimeout(sendList, 300));
    setTimeout(sendList, 2500);   // and once more, in case the device was not listening yet
  };
  if (window.max && window.max.bindInlet) initMax();
  else { let n = 0; const iv = setInterval(() => { if (window.max && window.max.bindInlet) { clearInterval(iv); initMax(); } else if (++n > 100) clearInterval(iv); }, 100); }

  // in a browser: listen to every MIDI input
  function webMidi() {
    if (midi || window.max || /\bMax\b|CEF/.test(navigator.userAgent) || !navigator.requestMIDIAccess) return;
    midi = navigator.requestMIDIAccess().then(a => {
      const hook = i => { i.onmidimessage = e => { const [st, d1, d2] = e.data; if ((st & 0xf0) === 0x90) noteIn(d1, d2, (st & 15) + 1); else if ((st & 0xf0) === 0x80) noteIn(d1, 0, (st & 15) + 1); }; };
      a.inputs.forEach(hook);
      a.onstatechange = e => { if (e.port.type === 'input' && e.port.state === 'connected') hook(e.port); };
    }).catch(() => { midi = null; });
  }

  // in a normal browser window: Ableton's Sonomika Bridge device sends notes and sound over a WebSocket (ws://127.0.0.1:8777)
  if (!window.max && /^(127\.0\.0\.1|localhost)$/.test(location.hostname)) {
    let wait = 2000;
    const connect = () => {
      let ws;
      try { ws = new WebSocket('ws://127.0.0.1:8777'); } catch (e) { return; }
      ws.onopen = () => { wait = 2000; window.SONO_BRIDGE = true; if (new URLSearchParams(location.search).has('full')) set(true); };   // the bridge's own full-screen window starts receiving; the app page waits for RECV
      ws.onmessage = e => {
        let d; try { d = JSON.parse(e.data); } catch (x) { return; }
        if (d.t === 'n') noteIn(d.m, d.v, d.ch);
        else if (d.t === 'a') window.SONO_AUDIO = { l: d.l || 0, m: d.m || 0, h: d.h || 0, t: performance.now() };
      };
      ws.onclose = () => { window.SONO_BRIDGE = false; setTimeout(connect, wait); wait = Math.min(15000, wait * 1.5); };
    };
    connect();
    // ?full=1: the picture fills the window (double-click or Esc to bring the app back)
    if (new URLSearchParams(location.search).has('full')) { if (document.body) fullView(); else addEventListener('DOMContentLoaded', fullView); }
  }

  // the Ableton (RECV) item, in the ☰ menu after MIDI
  const menu = document.getElementById('menup'), after = document.getElementById('midib');
  if (menu && !document.getElementById('recvb')) {
    const b = document.createElement('button');
    b.className = 'fld';
    b.id = 'recvb';
    b.type = 'button';
    b.dataset.label = 'Receive notes';
    b.title = 'Receive MIDI notes: play the patch from Ableton or a keyboard';
    b.setAttribute('aria-label', 'Receive MIDI notes');
    b.innerHTML = '<i data-ic="Radio" aria-hidden="true"></i>Ableton Link';
    if (after && after.parentNode === menu) after.after(b); else menu.append(b);
    b.onclick = () => set(!on);
    // the voice selector: what the incoming notes play
    const sel = document.createElement('select');
    sel.className = 'fld';
    sel.id = 'recvTo';
    sel.dataset.label = 'Notes play';
    sel.title = 'What the incoming notes play';
    sel.setAttribute('aria-label', 'Incoming notes play');
    b.after(sel);
    // and under it, a link to the library on GitHub (the public repository)
    const gh = document.createElement('a');
    gh.className = 'fld';
    gh.id = 'githubLink';
    gh.href = 'https://github.com/Sonomika/SonomikaPatch';
    gh.target = '_blank';
    gh.rel = 'noopener';
    gh.title = 'Sonomika Patch on GitHub';
    gh.style.textDecoration = 'none';   // looks like the other menu items, no underline
    gh.innerHTML = '<i data-ic="Github" aria-hidden="true"></i>GitHub';
    sel.after(gh);
    let sig = '';
    const fill = () => {
      // keep the Ableton item (and its menu) just below MIDI: the app builds the rest of the menu after this runs
      const mb = document.getElementById('midib');
      if (mb && mb.parentNode === menu && mb.nextElementSibling !== b) { mb.after(b); b.after(sel); const gl = document.getElementById('githubLink'); if (gl) sel.after(gl); }
      const P = cur(), vs = (P && P.voices) || [];
      const s2 = ((P && P.id) || '') + vs.map(x => x.id).join();
      sel.hidden = !on || !vs.length;
      if (s2 === sig) return;
      sig = s2;
      sel.innerHTML = vs.map(x => `<option value="${x.id}">${x.name}</option>`).join('') +
        (vs.length > 1 ? `<option value="ch">By MIDI channel (${vs.map((x, i) => (i + 1) + (i === vs.length - 1 && vs.length < 16 ? '-16' : '') + ' ' + x.name.split(' ').pop().toLowerCase()).join(', ')})</option>` : '');
      const to = getTo();
      sel.value = to && [...sel.options].some(o => o.value === to) ? to : (vs[0] ? vs[0].id : '');
    };
    sel.onchange = () => { try { localStorage.setItem(key(), sel.value); } catch (e) {} };
    fillRef = fill;
    fill();
    setInterval(fill, 1000);   // follows patch changes
  }
  paint();
  if (on) webMidi();
})();
