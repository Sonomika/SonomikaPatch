function makeButterfly(O = {}) {
  const MS = O.host && "9:16" === O.fmt ? "-916" : "";
  const BEAT = 60 / 170;
  const url = n => n.includes("/") ? "patches/butterfly/" + n + ".flac" : "patches/butterfly/kit/" + n + ".flac";
  const LIST = {
    "hh.c": {
      layers: [ 1, 2, 3, 4 ].map(v => [ 1, 2 ].map(r => `hh_closed_vl${v}_rr${r}`))
    },
    "hh.o": {
      layers: [ [ "hh_open_vl2_rr1" ], [ "hh_open_vl3_rr1" ], [ "hh_open_vl4_rr1", "hh_open_vl4_rr2" ] ]
    }
  };
  const FK = [ "a", "b", "c", "d" ], FR = [ "k", "s", "g", "h", "o", "p" ], FP = {
    k: "kick",
    s: "snare",
    g: "ltom",
    h: "hh",
    o: "ride",
    p: "htom"
  };
  const FN = [ ...FK.flatMap(k => FR.map(r => k + "_" + r)), "sub", "sub2", "reese", "siren", "boom", "sweep" ];
  const FG = {
    a_k: 1.05,
    b_k: .89,
    c_k: .74,
    d_k: 1.04,
    a_s: .9,
    b_s: 1.12,
    c_s: 1.13,
    d_s: 1.6,
    a_g: .79,
    b_g: 1.64,
    c_g: 1.19,
    d_g: .78,
    a_h: .94,
    b_h: .9,
    c_h: 1.24,
    d_h: .97,
    a_h2: .95,
    a_h3: 2.1,
    b_h2: .94,
    b_h3: 1.41,
    c_h2: 1.68,
    c_h3: 1.2,
    d_h2: .83,
    d_h3: .94,
    a_o: 1.02,
    b_o: .69,
    c_o: .82,
    d_o: .8,
    a_p: .79,
    b_p: .7,
    c_p: 1.07,
    d_p: .55,
    sub: 1,
    sub2: .85,
    reese: 1.1
  };
  const NG = {
    kick1: .64,
    kick2: .64,
    snare1: .55,
    snare2: .6,
    snare3: .8,
    ghost: .5,
    ride1: 1.1,
    ride2: 1.2,
    hat1: 1,
    hat2: 1,
    hat3: 1,
    perc1: 1,
    b808a: .6,
    b808b: .45,
    b808c: .6,
    reese1: 1,
    reese2: .6
  };
  const NAMES = [ ...new Set([ "hh.c", "hh.o" ].flatMap(k => LIST[k].layers.flat())) ].concat(FN.map(n => "syn/" + n));
  const PIECES = [ "kick", "snare", "hh", "htom", "ltom", "ride", "crash", "flat", "vox", "bass" ];
  const CHAN = {
    kick: "fkick",
    snare: "fsnare",
    hh: "fhat",
    htom: "fperc",
    ltom: "fghost",
    ride: "fopen",
    crash: "ffx",
    flat: "fbass",
    vox: "fsiren",
    bass: "freese"
  };
  const JLEV = {
    fx: .22,
    voc: .13
  };
  const LEVEL = {
    kick: .32,
    snare: .38,
    hh: 1.1,
    htom: .5,
    ltom: .5,
    ride: .9,
    crash: .3,
    flat: .26,
    vox: .12,
    bass: .3
  };
  const D = {
    fly: [],
    kb: {
      bass: [],
      keys: []
    },
    mc: {
      lv: [],
      pads: []
    },
    cuts: [],
    limbs: {
      L: [],
      R: [],
      RF: [],
      LF: []
    },
    lastHand: {
      L: -9,
      R: -9
    },
    buf: {},
    peak: {},
    wave: {},
    ok: !1,
    err: null,
    loading: null,
    rr: {},
    hits: {},
    openHat: null,
    crashes: [],
    bar: -1,
    events: [],
    phrase: "",
    notes: 0,
    view: null,
    views: null,
    raf: 0
  };
  PIECES.forEach(p => D.hits[p] = []);

  /* ---------- the sounds, synthesised: no samples, so the patch can be shared. Each name below was a one-shot; now it is made here,
     sample by sample, at the same length, pitch and character (the hats still come from the CC0 kit). Four kits: a punchy, b round,
     c snappy and bright, d deep. Seeded noise, so every load sounds the same. ---------- */
  const SR = 44100;
  function synthHit(name) {
    let seed = 0; for (const c of name) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
    const rnd = () => { seed = seed + 1831565813 >>> 0; let t = seed; t = Math.imul(t ^ t >>> 15, 1 | t); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296 * 2 - 1; };
    const make = sec => new Float32Array(Math.round(sec * SR)), TAU = 2 * Math.PI;
    // one-pole filters on a noise source
    const lp = (x, f) => { const a = Math.exp(-TAU * f / SR); let y = 0; for (let i = 0; i < x.length; i++) x[i] = y = (1 - a) * x[i] + a * y; return x; };
    const hp = (x, f) => { const a = Math.exp(-TAU * f / SR); let y = 0, p = 0; for (let i = 0; i < x.length; i++) { y = a * (y + x[i] - p); p = x[i]; x[i] = y; } return x; };
    const bp = (x, f, q) => { const w = TAU * f / SR, al = Math.sin(w) / (2 * q), b0 = al, a0 = 1 + al, a1 = -2 * Math.cos(w), a2 = 1 - al; let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < x.length; i++) { const y = (b0 * x[i] - b0 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x[i]; y2 = y1; y1 = y; x[i] = y; } return x; };
    const noise = sec => { const x = make(sec); for (let i = 0; i < x.length; i++) x[i] = rnd(); return x; };
    const sat = (x, d) => { const n = Math.tanh(d); for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * d) / n; return x; };
    const norm = (x, pk) => { let m = 0; for (const v of x) m = Math.max(m, Math.abs(v)); if (m) for (let i = 0; i < x.length; i++) x[i] *= pk / m; return x; };
    const fadeEnd = (x, sec) => { const n = Math.min(x.length, Math.round(sec * SR)); for (let i = 0; i < n; i++) x[x.length - 1 - i] *= i / n; return x; };
    // a pitched sweep: frequency f(t), amplitude env(t), plus a few harmonics
    const tone = (sec, f, env, harm = [1]) => { const x = make(sec); let ph = 0; for (let i = 0; i < x.length; i++) { const t = i / SR; ph += TAU * f(t) / SR; let v = 0; harm.forEach((a, k) => v += a * Math.sin(ph * (k + 1))); x[i] = v * env(t); } return x; };
    const mix = (...xs) => { const n = Math.max(...xs.map(([x]) => x.length)), o = make(n / SR); for (const [x, g] of xs) for (let i = 0; i < x.length; i++) o[i] += x[i] * g; return o; };
    const ex = (t, d) => Math.exp(-t / d);
    const K = { a: { k: [160, 51, .07, 1.6], s: [210, 1900, .06, .9], g: [300, 3600], p: ["rim", 308] },
                b: { k: [130, 47, .085, 1.2], s: [185, 1500, .07, .7], g: [260, 2800], p: ["block", 371] },
                c: { k: [190, 56, .05, 2.2], s: [240, 2600, .045, 1.2], g: [330, 4200], p: ["shaker", 2300] },
                d: { k: [120, 44, .09, 1.4], s: [170, 1300, .08, .6], g: [240, 2400], p: ["tom", 194] } };
    const [kit, role] = name.includes("_") ? name.split("_") : [null, name], P = kit && K[kit];
    let x;
    if (role === "k") { const [f0, f1, d, dr] = P.k;   // kick: a falling sine, driven, with a click on top
      x = mix([sat(tone(.2, t => f1 + (f0 - f1) * ex(t, .028), t => ex(t, d) * Math.min(1, t * 900)), dr), 1], [lp(hp(noise(.012), 1500), 9000).map((v, i) => v * ex(i / SR, .002)), .35]); }
    else if (role === "s") { const [ft, fn, d, body] = P.s;   // snare: a short tonal body and a band of noise
      x = mix([tone(.2, t => ft * (1 + .3 * ex(t, .01)), t => ex(t, .03), [1, .3]), body], [bp(noise(.2), fn, .7).map((v, i) => v * ex(i / SR, d)), 1.6], [hp(noise(.2), 6000).map((v, i) => v * ex(i / SR, d * .6)), .5]); }
    else if (role === "g") { const [ft, fn] = P.g;   // ghost: a tight, quiet little snare
      x = mix([tone(.08, t => ft, t => ex(t, .012)), .6], [bp(noise(.08), fn, 1.1).map((v, i) => v * ex(i / SR, .014)), 1.4]); }
    else if (role === "p") { const [kind, f] = P.p;   // percussion: a different voice per kit
      if (kind === "rim") x = mix([tone(.09, t => f, t => ex(t, .01), [1, 0, .5]), 1], [bp(noise(.09), 3500, 2).map((v, i) => v * ex(i / SR, .006)), 1.2]);
      else if (kind === "block") x = tone(.09, t => f * (1 + .05 * ex(t, .004)), t => ex(t, .018), [1, .45, 0, .2]);
      else if (kind === "shaker") x = hp(noise(.2), 5000).map((v, i) => { const t = i / SR; return v * Math.min(1, t / .02) * ex(t, .045); });
      else x = sat(tone(.16, t => f * (1 + .4 * ex(t, .02)), t => ex(t, .05), [1, .2]), 1.3); }
    else if (role === "h" || role === "h2" || role === "h3") x = hp(noise(.08), 7000).map((v, i) => v * ex(i / SR, role === "h" ? .015 : role === "h2" ? .01 : .022));
    else if (role === "o") x = hp(noise(.5), 6500).map((v, i) => v * ex(i / SR, .12));
    else if (role === "sub") x = fadeEnd(tone(1.5, t => 53.2, t => Math.min(1, t * 200) * (t < .9 ? 1 : ex(t - .9, .25)), [1, .08]), .05);   // bass: a pure sub, root ≈ 53 Hz
    else if (role === "sub2") x = fadeEnd(sat(tone(.9, t => 99.6, t => Math.min(1, t * 200) * (t < .5 ? 1 : ex(t - .5, .15)), [1, .15, .05]), 1.6), .05);
    else if (role === "reese") {   // reese: two detuned saws, filtered, slowly phasing
      const n = Math.round(1.2 * SR); x = make(1.2); let p1 = 0, p2 = 0, p3 = 0;
      for (let i = 0; i < n; i++) { p1 = (p1 + 98.2 * 1.006 / SR) % 1; p2 = (p2 + 98.2 * .994 / SR) % 1; p3 = (p3 + 98.2 / 2 / SR) % 1; x[i] = (p1 * 2 - 1) + (p2 * 2 - 1) + .6 * Math.sin(TAU * p3); }
      lp(x, 1400); lp(x, 2200); sat(x, 1.4); for (let i = 0; i < n; i++) x[i] *= Math.min(1, i / (.005 * SR)); fadeEnd(x, .08); }
    else if (role === "siren") x = fadeEnd(lp(tone(2, t => 384 * Math.pow(1.6, .5 + .5 * Math.sin(TAU * (.9 + t * .25) * t)), t => Math.min(1, t / .25), [1, .5, .3, .2, .12]), 3200), .5);   // a rave siren, speeding up
    else if (role === "boom") x = mix([sat(tone(3, t => 34 + 26 * ex(t, .25), t => ex(t, 1.1) * Math.min(1, t * 300)), 1.5), 1], [lp(noise(.4), 400).map((v, i) => v * ex(i / SR, .08)), .8]);   // a long, low boom
    else if (role === "sweep") { const n = Math.round(4.9 * SR); x = noise(4.9); let lo = 0, bd = 0;   // white noise through a band that sweeps up, then down
      for (let i = 0; i < n; i++) { const t = i / SR, f = 300 * Math.pow(30, Math.sin(Math.PI * t / 4.9)), F = 2 * Math.sin(Math.PI * Math.min(f, 15000) / SR), hi = x[i] - lo - .7 * bd; bd += F * hi; lo += F * bd; x[i] = bd * Math.sin(Math.PI * t / 4.9); } }
    else x = make(.05);
    norm(x, 1.2);
    const b = new AudioBuffer({ length: x.length, numberOfChannels: 1, sampleRate: SR });
    b.copyToChannel(x, 0);
    return b;
  }
  function load() {
    if (D.loading) return D.loading;
    D.missing = [];
    D.loading = Promise.all(NAMES.map(async n => {
      let b;
      try {
        if (n.startsWith("syn/")) b = synthHit(n.slice(4)); else {   // the one-shots are synthesised; the hats are loaded from the CC0 kit
        const r = await fetch(assetURL(url(n)));
        if (!r.ok) throw new Error(n);
        b = await (ab => new Promise((res, rej) => {
          const oc = new OfflineAudioContext(2, 1, 44100);
          const p = oc.decodeAudioData(ab, res, rej);
          p && p.then && p.then(res, rej);
        }))(await r.arrayBuffer());
        }
      } catch (e) {
        D.missing.push(n);
        return;
      }
      D.buf[n] = b;
      const L = b.getChannelData(0), R = b.numberOfChannels > 1 ? b.getChannelData(1) : L;
      let pk = 0;
      const W = new Float32Array(160), step = Math.ceil(L.length / 160);
      for (let i = 0; i < L.length; i++) {
        const a = Math.max(Math.abs(L[i]), Math.abs(R[i]));
        a > pk && (pk = a);
        const j = Math.floor(i / step);
        a > W[j] && (W[j] = a);
      }
      D.peak[n] = pk;
      D.wave[n] = W;
    })).then(() => {
      D.ok = !0;
      D.missing.length && console.warn("Sonomika Patch: " + D.missing.length + " sounds missing (e.g. a licensed sample pack not included)", D.missing);
    }).catch(e => {
      D.err = String(e);
    });
    return D.loading;
  }
  const HHTUNE = [ 1, .95, 1.05, .91 ];
  function strike(e, t, ui) {
    if ("kb" !== e.p) if ("fp" !== e.p) if ("jl" !== e.p) ; else {
      !function jplay(e, t) {
        if (!D.ok || MUTE[e.ch]) return;
        const b = D.buf[e.n];
        if (!b) return;
        const at = Math.max(ctx.currentTime, t), off = e.off * BEAT, len = e.len * BEAT, L = JLEV[e.kind] * (e.g || 1);
        const s = ctx.createBufferSource(), g = ctx.createGain();
        s.buffer = b;
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(L, at + .003);
        g.gain.setValueAtTime(L, at + Math.max(.004, len - .004));
        g.gain.linearRampToValueAtTime(0, at + len);
        if (e.choke) {
          if (D.mcCh && D.mcCh.end > at) {
            D.mcCh.g.gain.cancelScheduledValues(at);
            D.mcCh.g.gain.setTargetAtTime(0, at, .006);
          }
          D.mcCh = {
            g,
            end: at + len
          };
        }
        s.connect(g);
        g.connect("brk" === e.kind ? void 0 : chan(CHAN[e.ch]));
        s.start(at, off, len + .01);
      }(e, t);
      if (null != e.fpad) {
        const b = D.buf[e.n];
        D.fly.push({
          t: Math.max(ctx.currentTime, t),
          pad: e.fpad,
          v: 1,
          wn: e.n,
          dur: Math.min(e.len * BEAT, b ? b.duration : 1)
        });
        D.fly.length > 128 && D.fly.shift();
      }
      ui.push([ e.ch + ".hit" ]);
    } else {
      !function flyHit(e, t) {
        const hat = "h" === e.r || "o" === e.r, human = hat || "g" === e.r || "p" === e.r, off = Math.abs(4 * e.o - Math.round(4 * e.o)) < .01 && Math.round(4 * e.o) % 2 == 1;
        human && (t += (off ? BEAT / 4 * .09 : 0) + .007 * (Math.random() - .5));
        const n = FK[e.k] + "_" + e.r, at = Math.max(ctx.currentTime, t), p = FP[e.r], v = e.v;
        let wn = hat ? null : "syn/" + n, dur = .3;
        if (D.ok && !MUTE[p]) {
          let b, L;
          if (hat) {
            const pk = function pick(key, v) {
              const L = LIST[key].layers, n = L.length, top = Math.max(...L[n - 1].map(x => D.peak[x] || 1));
              const li = Math.max(0, Math.min(n - 1, Math.round(v * (n - 1) + .6 * (Math.random() - .5))));
              const rk = key + li;
              D.rr[rk] = ((D.rr[rk] || 0) + 1) % L[li].length;
              const name = L[li][D.rr[rk]];
              const want = top * (.06 + .94 * Math.pow(v, 1.4)), gain = Math.max(.35, Math.min(3, want / (D.peak[name] || 1)));
              return {
                name,
                gain
              };
            }("h" === e.r ? "hh.c" : "hh.o", v);
            b = D.buf[pk.name];
            L = pk.gain * LEVEL[p];
            wn = pk.name;
          } else {
            b = D.buf["syn/" + n];
            L = LEVEL[p] * (FG[n] || 1) * Math.pow(v, 1.3);
          }
          b && (dur = b.duration / (hat ? HHTUNE[e.k] : 1));
          if (b) {
            const s = ctx.createBufferSource(), g = ctx.createGain();
            s.buffer = b;
            s.playbackRate.value = hat ? HHTUNE[e.k] : 1 + .02 * (Math.random() - .5);
            g.gain.value = L;
            if (hat || "k" === e.r) s.connect(g); else {
              const f = ctx.createBiquadFilter();
              f.type = "lowpass";
              f.frequency.value = 1800 + 17e3 * Math.pow(v, 1.6);
              f.Q.value = .5;
              s.connect(f);
              f.connect(g);
            }
            g.connect(chan(CHAN[p]));
            s.start(at);
            if (hat && D.flyOpen && D.flyOpen.end > at) {
              D.flyOpen.g.gain.setTargetAtTime(0, at, .02);
              D.flyOpen = null;
            }
            "o" === e.r && (D.flyOpen = {
              g,
              end: at + b.duration
            });
          }
        }
        D.fly.push({
          t: at,
          pad: 6 * e.k + FR.indexOf(e.r),
          v,
          wn,
          dur
        });
        D.fly.length > 128 && D.fly.shift();
        D.hits[p].push({
          t: at,
          v,
          a: "v",
          name: "",
          dur: .3,
          gain: 1
        });
        D.hits[p].length > 48 && D.hits[p].shift();
      }(e, t);
      ui.push([ FP[e.r] + ".hit" ]);
    } else {
      !function kbPlay(e, t) {
        const at = Math.max(ctx.currentTime, t), who = e.who, ch = "bass" === who ? "flat" : "vox";
        if (e.n && D.ok && !MUTE[ch]) {
          const b = D.buf[e.n];
          if (b) {
            const s = ctx.createBufferSource(), g = ctx.createGain(), len = e.len * BEAT, L = LEVEL[ch] * (NG[e.n.slice(4)] || FG[e.n.slice(4)] || 1) * (e.g || 1);
            s.buffer = b;
            s.playbackRate.value = Math.pow(2, (e.semi || 0) / 12);
            g.gain.setValueAtTime(0, at);
            g.gain.linearRampToValueAtTime(L, at + .004);
            g.gain.setValueAtTime(L, at + len);
            g.gain.linearRampToValueAtTime(0, at + len + .06);
            if ("bass" === who) {
              if (D.bassCh && D.bassCh.end > at) {
                D.bassCh.g.gain.cancelScheduledValues(at);
                D.bassCh.g.gain.setTargetAtTime(0, at, .01);
              }
              D.bassCh = {
                g,
                end: at + len
              };
            }
            s.connect(g);
            g.connect(chan(CHAN[ch]));
            s.start(at);
            s.stop(at + len + .12);
          }
        }
        const st = D.kb[who];
        st.push({
          t: at,
          keys: e.keys,
          len: e.len * BEAT
        });
        st.length > 48 && st.shift();
        D.hits[ch].push({
          t: at,
          v: e.v || .8,
          a: "n",
          name: "",
          dur: .4,
          gain: 1
        });
        D.hits[ch].length > 48 && D.hits[ch].shift();
      }(e, t);
      ui.push([ ("bass" === e.who ? "flat" : "vox") + ".hit" ]);
    }
  }
  let seedR = 1;
  const FXPAD = {
    siren: 24,
    sweep: 25,
    boom: 26
  };
  const FH = (E, k, r, v, o, x) => E.push({
    p: "fp",
    k,
    r,
    v: Math.max(.05, Math.min(1, v)),
    o,
    ...x
  });
  function fbrk(E, r, k, name, edit, {gh = 1, hat = !0, hk = k, soft = 1, from = 0, to = 4} = {}) {
    const P = JP[name], ch = knob("brain.chop");
    edit = Math.min(.95, 2 * edit * ch);
    const map = [ 0, 1, 2, 3 ].map(q => q > 0 && r() < edit ? Math.floor(4 * r()) : q);
    for (let q = from; q < to; q++) {
      const src = map[q];
      for (let j = 0; j < 4; j++) {
        const st = 4 * src + j, o = q + j / 4;
        P.k.includes(st) && FH(E, k, "k", (.8 + .2 * (0 === j)) * soft, o);
        P.s.includes(st) && FH(E, k, "s", (st % 8 == 4 ? .95 : .72) * soft, o);
        P.g.includes(st) && r() < .8 * gh * 2 * knob("brain.ghost") && FH(E, k, "g", (.3 + .1 * r()) * soft, o);
        if (hat) {
          const hv = [ .85, .28, .6, .36 ][j] * (.85 + .3 * r());
          (j % 2 == 0 || r() < .45) && FH(E, hk, "h", hv * soft, o);
        }
      }
    }
  }
  const ftrip = (E, k, v = .55, r = "p") => {
    for (let i = 0; i < 16; i += 3) FH(E, k, r, v * (i % 12 == 0 ? 1 : .7) * (.85 + .3 * Math.random()), i / 4);
  };
  const fcascade = (E, from, len, roles = "ssgs") => {
    for (let i = 0; i < 8 * len; i++) FH(E, i % 4, roles[i % roles.length], .45 + .5 * i / (8 * len), from + i / 8);
  };
  const fratchet = (E, k) => {
    for (let q = E.length - 1; q >= 0; q--) "fp" === E[q].p && E[q].o >= 3.5 && ("s" === E[q].r || "g" === E[q].r) && E.splice(q, 1);
    for (let i = 0; i < 6; i++) FH(E, k, "s", .5 + .08 * i, 3.5 + i / 12);
  };
  const FBL = {
    a: [ [ 0, 0, 6 ], [ 6, 0, 2 ], [ 10, 3, 3 ], [ 14, -2, 2 ] ],
    b: [ [ 0, 0, 3 ], [ 3, 0, 3 ], [ 6, -4, 4 ], [ 10, -5, 3 ], [ 13, -2, 3 ] ],
    c: [ [ 0, 0, 4 ], [ 8, -4, 4 ], [ 12, -2, 4 ] ]
  };
  const JP = {
    amen: {
      k: [ 0, 2, 10, 11 ],
      s: [ 4, 7, 9, 12, 15 ],
      g: [ 6, 14 ]
    },
    think: {
      k: [ 0, 6, 10 ],
      s: [ 4, 12 ],
      g: [ 3, 7, 9, 14 ]
    },
    step: {
      k: [ 0, 10 ],
      s: [ 4, 12 ],
      g: [ 7, 15 ]
    },
    roller: {
      k: [ 0, 3, 8, 11 ],
      s: [ 4, 12 ],
      g: [ 6, 9, 14, 15 ]
    }
  };
  const knob = (k, d = .5) => {
    try {
      const h = holds()[k];
      return null != h ? h : d;
    } catch (e) {
      return d;
    }
  };
  const SCREENS = [ {
    p: "fly",
    title: "BUTTERFLY",
    hue: 0
  } ];
  Object.fromEntries(SCREENS.map(S => [ S.p, S.hue ]));
  const FX = {
    comets: [],
    waves: [],
    links: [],
    white: -9,
    last: {
      p: "fly",
      t: -9
    }
  };
  function monitors() {
    D.views || (D.views = SCREENS.map(S => {
      const element = document.createElement("section"), canvas = document.createElement("canvas");
      element.className = "flock-monitor drum-window drum-fly" + (O.vert ? " drum-fvert" : "");
      {
        const [c, r, sp] = LANDGRID[S.p];
        element.style.gridColumn = c + ("w4" === sp ? " / span 4" : sp ? " / span 2" : "");
        element.style.gridRow = r + (1 === sp ? " / span 2" : "");
      }
      canvas.className = "flock-canvas";
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", "a chrome butterfly in the ink, its six legs playing a halo of 24 drum pads");
      element.append(canvas);
      return {
        ...S,
        id: "drum-" + S.p + MS,
        sourceKey: "brain.s",
        element,
        canvas,
        g: canvas.getContext("2d"),
        st: {
          parts: [],
          rings: [],
          last: 0
        }
      };
    }));
    D.raf || (D.raf = requestAnimationFrame(animate));
    return D.views;
  }
  const TAU = 2 * Math.PI;
  function animate() {
    D.raf = requestAnimationFrame(animate);
    PATCH === P && D.views && !D.offline && renderAt(ctx ? ctx.currentTime - (ctx.outputLatency || 0) : performance.now() / 1e3);
  }
  function renderAt(now) {
    if (!D.views) return;
    const G = {};
    D.views.forEach(V => {
      if (!V.canvas.isConnected) {
        V.r = null;
        return;
      }
      const r = V.canvas.getBoundingClientRect();
      if (r.width) {
        V.r = r;
        G[V.p] = [ r.left + r.width / 2, r.top + r.height / 2 ];
      } else V.r = null;
    });
    FX.comets = FX.comets.filter(c => now - c.t1 < .35);
    FX.waves = FX.waves.filter(w => now - w.t < 2.2);
    let l = 1e9, t = 1e9, r = -1e9, b = -1e9;
    D.views.forEach(V => {
      if (V.r) {
        l = Math.min(l, V.r.left);
        t = Math.min(t, V.r.top);
        r = Math.max(r, V.r.right);
        b = Math.max(b, V.r.bottom);
      }
    });
    D.wall = {
      l,
      t,
      w: r - l,
      h: b - t
    };
    let cut = 0, c0 = null;
    for (const c of D.cuts) if (now >= c.t0 - .05 && now <= c.t1 + .15) {
      const a = Math.min(1, "count" === c.kind ? 1 : (now - c.t0 + .05) / .15, (c.t1 + .15 - now) / .15);
      if (a > cut) {
        cut = a;
        c0 = c;
      }
    }
    D.cut = Math.max(0, cut);
    D.cutC = c0;
    if (D.recHold) if ("go" === D.recHold && cut > 0) D.recHold = !1; else {
      D.cut = 1;
      D.cutC = {
        t0: now + 60,
        t1: now + 70,
        kind: "count"
      };
    }
    D.views.forEach(V => {
      V.r && function drawScreen(V, now) {
        const {canvas} = V, dpr = D.rec && D.recW ? (D.recW[V.p] || D.recW._) / V.r.width : D.rec && D.recW ? Math.max(Math.min(1.5, devicePixelRatio || 1), (D.recW[V.p] || D.recW._) / V.r.width) : Math.min(1.5, devicePixelRatio || 1), w = Math.max(1, Math.round(V.r.width * dpr)), h = Math.max(1, Math.round(V.r.height * dpr));
        if ("fly" === V.p) {
          const W2 = D.recSelf ? O.vert ? 1080 : 1920 : w, H2 = D.recSelf ? O.vert ? 1920 : 1080 : h;
          if (canvas.width !== W2 || canvas.height !== H2) {
            canvas.width = W2;
            canvas.height = H2;
          }
          drawFly(0, now, V.g, W2, H2);
          return;
        }
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        const g = V.sg, st = V.st;
        Math.min(w, h);
        st.last > now + .5 && (st.last = 0);
        g.globalCompositeOperation = "source-over";
        g.fillStyle = `rgba(0,0,0,1)`;
        g.fillRect(0, 0, w, h);
        g.globalCompositeOperation = "lighter";
        if ("fly" === V.p) drawFly(0, now, g, w, h); else if ("big" === V.p) {
          drawBig(now, w, h);
          g.globalCompositeOperation = "source-over";
          g.drawImage(BIG.cv, 0, 0, w, h);
          !function inkFinish(g, W, H) {
            const vg = g.createRadialGradient(W / 2, H / 2, .35 * Math.min(W, H), W / 2, H / 2, .75 * Math.max(W, H));
            vg.addColorStop(0, "rgba(0,0,0,0)");
            vg.addColorStop(1, "rgba(0,0,0,.6)");
            g.fillStyle = vg;
            g.fillRect(0, 0, W, H);
          }(g, w, h);
        };
        D.cut;
      }(V, now);
    });
    D.rec && D.recSelf;
  }
  const LANDGRID = {
    fly: [ 1, 1 ]
  };
  function env(p, now, rate) {
    let e = 0;
    for (const h of D.hits[p] || []) h.t > now || (e += h.v * Math.exp(-(now - h.t) * rate));
    return e;
  }
  const HEAD = {
    state: "idle"
  };
  function loadHead() {
    if ("idle" === HEAD.state) {
      HEAD.state = "loading";
      Promise.all([ import("three"), import("three/addons/loaders/GLTFLoader.js"), import("three/addons/geometries/RoundedBoxGeometry.js"), import("three/addons/environments/RoomEnvironment.js") ]).then(([T, {GLTFLoader}, {RoundedBoxGeometry}, {RoomEnvironment}]) => {
        HEAD.RB = RoundedBoxGeometry;
        HEAD.Room = RoomEnvironment;
        HEAD.state = "fly";
        try {
          !function buildFly(T) {
            KIT3.T = KIT3.T || T;
            const R = new T.WebGLRenderer({
              canvas: document.createElement("canvas"),
              antialias: !0,
              alpha: !0
            });
            R.setClearColor(0, 0);
            R.toneMapping = T.ACESFilmicToneMapping;
            R.outputColorSpace = T.SRGBColorSpace;
            const sc = new T.Scene, cam = new T.PerspectiveCamera(30, O.vert ? 9 / 16 : 16 / 9, .1, 100);
            sc.add(new T.HemisphereLight(16777215, 1118481, .35));
            const key = new T.DirectionalLight(16777215, 2.2);
            key.position.set(2, 3, 4);
            sc.add(key);
            const rim = new T.DirectionalLight(16777215, 1.4);
            rim.position.set(-3, 1, -3);
            sc.add(rim);
            sc.environment = new T.PMREMGenerator(R).fromScene(new HEAD.Room, .04).texture;
            const chrome = function robotMats(T) {
              return {
                steel: new T.MeshStandardMaterial({
                  color: 13487565,
                  metalness: .65,
                  roughness: .3
                }),
                dark: new T.MeshStandardMaterial({
                  color: 1842204,
                  metalness: .5,
                  roughness: .4
                }),
                chrome: new T.MeshStandardMaterial({
                  color: 15658734,
                  metalness: 1,
                  roughness: .12
                }),
                light: new T.MeshStandardMaterial({
                  color: 16777215,
                  emissive: 16777215,
                  emissiveIntensity: .4
                })
              };
            }(T).chrome;
            new T.LineBasicMaterial({
              color: 15921906
            }), new T.LineBasicMaterial({
              color: 15921906,
              transparent: !0,
              opacity: .4
            }), new T.LineBasicMaterial({
              color: 15921906,
              transparent: !0,
              opacity: .18
            });
            const fly = new T.Group, FS = O.vert ? 1.25 : 1;
            fly.scale.setScalar(FS);
            sc.add(fly);
            const velvet = new T.MeshPhysicalMaterial({
              color: 789519,
              roughness: .9,
              metalness: 0,
              sheen: 1,
              sheenRoughness: .6,
              sheenColor: new T.Color(5924982)
            });
            {
              const fur = new T.MeshPhysicalMaterial({
                color: 1053715,
                roughness: .9,
                sheen: 1,
                sheenRoughness: .45,
                sheenColor: new T.Color(3124886)
              }), eyeM = new T.MeshStandardMaterial({
                color: 460551,
                roughness: .18,
                metalness: .3
              });
              const head = new T.Mesh(new T.SphereGeometry(.05, 24, 16), velvet);
              head.position.y = .285;
              fly.add(head);
              [ -1, 1 ].forEach(sd => {
                const e = new T.Mesh(new T.SphereGeometry(.029, 20, 14), eyeM);
                e.position.set(.036 * sd, .295, .02);
                fly.add(e);
              });
              const th = new T.Mesh(new T.SphereGeometry(.075, 28, 18), fur);
              th.scale.set(1, 1.55, .85);
              th.position.y = .15;
              fly.add(th);
              const prof = [ new T.Vector2(0, 0) ];
              for (let i = 0; i <= 48; i++) {
                const u = i / 48, body = u < .24 ? .42 + .58 * Math.sin(u / .24 * Math.PI / 2) : 1 - .28 * Math.pow((u - .24) / .76, 1.4), tip = u > .86 ? Math.sqrt(Math.max(0, 1 - Math.pow((u - .86) / .14, 2))) : 1;
                prof.push(new T.Vector2(Math.max(.001, .05 * body * tip * (1 + .015 * Math.sin(u * Math.PI * 12))), .5 * -u));
              }
              prof.reverse();
              const ab = new T.Mesh(new T.LatheGeometry(prof, 24), fur);
              ab.position.y = .045;
              ab.scale.z = .85;
              fly.add(ab);
            }
            const ant = [ -1, 1 ].map(sd => {
              const geo = (new T.BufferGeometry).setFromPoints(Array.from({
                length: 21
              }, () => new T.Vector3)), ln = new T.Line(geo, new T.LineBasicMaterial({
                color: 9080470
              }));
              sc.add(ln);
              const tip = new T.Mesh(new T.SphereGeometry(.014, 12, 8), velvet);
              tip.scale.set(1, 1.8, 1);
              sc.add(tip);
              return {
                sd,
                geo,
                tip,
                cur: null,
                pad: sd < 0 ? 24 : 25
              };
            });
            const FW = [ [ 0, .1 ], [ .22, .4 ], [ .5, .74 ], [ .8, .95 ], [ .98, 1 ], [ 1.1, .92 ], [ 1.1, .72 ], [ 1.04, .5 ], [ .96, .32 ], [ .84, .2 ], [ .58, .13 ], [ .28, .1 ], [ .02, .06 ] ], HW = [ [ .01, .06 ], [ .38, .13 ], [ .72, .06 ], [ .9, -.12 ], [ .95, -.28 ], [ .88, -.36 ], [ .9, -.46 ], [ .8, -.53 ], [ .8, -.63 ], [ .69, -.68 ], [ .67, -.78 ], [ .57, -.82 ], [ .53, -.92 ], [ .52, -1.18 ], [ .47, -1.27 ], [ .4, -1.25 ], [ .39, -1.12 ], [ .41, -.93 ], [ .33, -.88 ], [ .22, -.8 ], [ .12, -.7 ], [ .065, -.56 ], [ .045, -.38 ], [ .03, -.2 ], [ .02, -.06 ] ];
            const noise = (x, y) => {
              const s = 43758.5453 * Math.sin(12.9898 * x + 78.233 * y);
              return s - Math.floor(s);
            };
            const wing = (P, eye, hind) => {
              const g = new T.Group, pts = (P => new T.CatmullRomCurve3(P.map(([x, y]) => new T.Vector3(x, y, 0)), !0, "centripetal").getPoints(140))(P), geo = new T.ShapeGeometry(new T.Shape(pts.map(p => new T.Vector2(p.x, p.y)))), tx = ((pts, P, hind) => {
                let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
                pts.forEach(p => {
                  x0 = Math.min(x0, p.x);
                  y0 = Math.min(y0, p.y);
                  x1 = Math.max(x1, p.x);
                  y1 = Math.max(y1, p.y);
                });
                const W = 1024, H = Math.round(W * (y1 - y0) / (x1 - x0)), mk = () => {
                  const c = document.createElement("canvas");
                  c.width = W;
                  c.height = H;
                  return c;
                }, c = mk(), m = mk(), x = c.getContext("2d"), xm = m.getContext("2d");
                const map = (px, py) => [ (px - x0) / (x1 - x0) * W, (1 - (py - y0) / (y1 - y0)) * H ], [rx0, ry0] = map(P[0][0], P[0][1]);
                const bg = x.createRadialGradient(rx0, ry0, 0, rx0, ry0, Math.hypot(W, H));
                bg.addColorStop(0, "#14141a");
                bg.addColorStop(.5, "#08080b");
                bg.addColorStop(1, "#040405");
                x.fillStyle = bg;
                x.fillRect(0, 0, W, H);
                xm.fillStyle = "#000";
                xm.fillRect(0, 0, W, H);
                const outer = [];
                for (let k = 0; k < pts.length; k += Math.max(1, Math.floor(pts.length / (hind ? 15 : 13)))) outer.push(pts[k]);
                const ang = outer.map(p => Math.atan2(-(map(p.x, p.y)[1] - ry0), map(p.x, p.y)[0] - rx0)).map(a => a), reach = outer.map(p => Math.hypot(...map(p.x, p.y).map((v, i) => v - (i ? ry0 : rx0))));
                const order = ang.map((a, i) => [ a, i ]).sort((a, b) => a[0] - b[0]).map(v => v[1]);
                const blueFrac = i => {
                  const a = ang[i];
                  return hind ? .7 + .1 * noise(i, 3) : a > 1.15 ? .32 + .1 * noise(i, 1) : a > .8 ? .55 + .08 * noise(i, 2) : .68 + .08 * noise(i, 4);
                };
                for (let q = 0; q < order.length - 1; q++) {
                  const i = order[q], j = order[q + 1], a0 = ang[i], a1 = ang[j];
                  if (a1 - a0 > 1.2) continue;
                  const f = (blueFrac(i) + blueFrac(j)) / 2, R0 = Math.min(reach[i], reach[j]);
                  for (const [ctx2, col] of [ [ x, null ], [ xm, "#fff" ] ]) {
                    ctx2.beginPath();
                    ctx2.moveTo(rx0, ry0);
                    const n = 22;
                    for (let s = 0; s <= n; s++) {
                      const a = a0 + (a1 - a0) * s / n, bulge = R0 * f * (1 + .05 * Math.sin(s / n * Math.PI) + .07 * (noise(31 * i + s, q) - .5) - .12 * Math.pow(2 * Math.abs(s / n - .5), 6));
                      ctx2.lineTo(rx0 + Math.cos(a) * bulge, ry0 - Math.sin(a) * bulge);
                    }
                    ctx2.closePath();
                    if (col) {
                      ctx2.fillStyle = col;
                      ctx2.fill();
                    } else {
                      const gb = ctx2.createRadialGradient(rx0, ry0, 0, rx0, ry0, R0 * f);
                      const lv = .82 + .3 * noise(i, 5);
                      const cc = (r, g2, b2) => `rgb(${r * lv | 0},${g2 * lv | 0},${b2 * lv | 0})`;
                      gb.addColorStop(0, "#14302e");
                      gb.addColorStop(.18, cc(30, 110, 140));
                      gb.addColorStop(.45, cc(48, 165, 222));
                      gb.addColorStop(.8, cc(70, 188, 240));
                      gb.addColorStop(1, cc(40, 150, 215));
                      ctx2.fillStyle = gb;
                      ctx2.fill();
                    }
                  }
                }
                x.save();
                x.globalCompositeOperation = "source-atop";
                x.filter = "blur(3px)";
                x.drawImage(c, 0, 0);
                x.restore();
                xm.filter = "blur(6px)";
                xm.drawImage(m, 0, 0);
                xm.filter = "none";
                for (let q = 0; q < order.length - 1; q++) {
                  const i = order[q], j = order[q + 1], a0 = ang[i], a1 = ang[j];
                  if (a1 - a0 > 1.2) continue;
                  const f = (blueFrac(i) + blueFrac(j)) / 2, R0 = Math.min(reach[i], reach[j]);
                  for (let k = 0; k < 160; k++) {
                    const a = a0 + (a1 - a0) * Math.random(), rr = R0 * f * (.94 + .18 * Math.random());
                    x.fillStyle = `rgba(${200 + 40 * Math.random() | 0},${215 + 30 * Math.random() | 0},235,${.05 + .12 * Math.random()})`;
                    x.fillRect(rx0 + Math.cos(a) * rr, ry0 - Math.sin(a) * rr, 1.6, 1.6);
                  }
                }
                x.save();
                x.globalCompositeOperation = "source-atop";
                for (let k = 0; k < 900; k++) {
                  const a = Math.random() * TAU, r0 = Math.random() * Math.hypot(W, H) * .6, l = 1 * (20 + 60 * Math.random());
                  x.strokeStyle = Math.random() < .5 ? `rgba(0,20,40,${.12 + .15 * Math.random()})` : `rgba(160,235,255,${.05 + .08 * Math.random()})`;
                  x.lineWidth = 1 * (1 + 2 * Math.random());
                  x.beginPath();
                  x.moveTo(rx0 + Math.cos(a) * r0, ry0 - Math.sin(a) * r0);
                  x.lineTo(rx0 + Math.cos(a) * (r0 + l), ry0 - Math.sin(a) * (r0 + l));
                  x.stroke();
                }
                x.restore();
                if (!hind) for (let q = 0; q < order.length - 1; q++) {
                  const i = order[q], j = order[q + 1], a0 = ang[i], a1 = ang[j];
                  if (a1 - a0 > 1.2) continue;
                  const f = (blueFrac(i) + blueFrac(j)) / 2, R0 = Math.min(reach[i], reach[j]), am = (a0 + a1) / 2, hw = .28 * (a1 - a0);
                  x.save();
                  x.filter = "blur(5px)";
                  x.fillStyle = "rgba(120,128,140,.22)";
                  x.beginPath();
                  x.moveTo(rx0 + Math.cos(am - hw) * R0 * (f + .1), ry0 - Math.sin(am - hw) * R0 * (f + .1));
                  x.lineTo(rx0 + Math.cos(am) * R0 * .9, ry0 - Math.sin(am) * R0 * .9);
                  x.lineTo(rx0 + Math.cos(am + hw) * R0 * (f + .1), ry0 - Math.sin(am + hw) * R0 * (f + .1));
                  x.closePath();
                  x.fill();
                  x.restore();
                }
                x.lineCap = "round";
                outer.forEach((p, i) => {
                  const [ex, ey] = map(P[0][0] + .97 * (p.x - P[0][0]), P[0][1] + .97 * (p.y - P[0][1]));
                  x.strokeStyle = "rgba(3,4,8,.85)";
                  x.lineWidth = 1 * (2.2 + 1.4 * noise(i, 7));
                  x.beginPath();
                  x.moveTo(rx0, ry0);
                  x.quadraticCurveTo((rx0 + ex) / 2 + 30 * (noise(i, 9) - .5) * 1, (ry0 + ey) / 2 + 30 * (noise(i, 8) - .5) * 1, ex, ey);
                  x.stroke();
                });
                for (let k = 0; k < 26e3; k++) {
                  const a = Math.random() * TAU, rr = Math.random() * Math.hypot(W, H), px = rx0 + Math.cos(a) * rr, py = ry0 + Math.sin(a) * rr;
                  if (px < 0 || py < 0 || px > W || py > H) continue;
                  const l = 1 * (3 + 5 * Math.random());
                  x.strokeStyle = Math.random() < .5 ? `rgba(255,255,255,${.015 + .03 * Math.random()})` : `rgba(0,0,0,${.05 + .08 * Math.random()})`;
                  x.lineWidth = .9;
                  x.beginPath();
                  x.moveTo(px, py);
                  x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l);
                  x.stroke();
                }
                const path = () => {
                  x.beginPath();
                  pts.forEach((p, k) => {
                    const q = map(p.x, p.y);
                    k ? x.lineTo(...q) : x.moveTo(...q);
                  });
                  x.closePath();
                };
                x.strokeStyle = "rgba(0,0,0,.9)";
                x.lineWidth = 14;
                path();
                x.stroke();
                x.strokeStyle = "rgba(190,200,215,.18)";
                x.lineWidth = 1.5;
                path();
                x.stroke();
                const t = new T.CanvasTexture(c), tm = new T.CanvasTexture(m);
                t.colorSpace = T.SRGBColorSpace;
                t.anisotropy = 8;
                return {
                  t,
                  tm,
                  x0,
                  y0,
                  x1,
                  y1
                };
              })(pts, P, hind);
              const pos = geo.attributes.position, uv = geo.attributes.uv;
              for (let k = 0; k < pos.count; k++) uv.setXY(k, (pos.getX(k) - tx.x0) / (tx.x1 - tx.x0), (pos.getY(k) - tx.y0) / (tx.y1 - tx.y0));
              uv.needsUpdate = !0;
              g.add(new T.Mesh(geo, new T.MeshBasicMaterial({
                map: tx.t,
                side: T.DoubleSide,
                toneMapped: !1
              })));
              const sheen = new T.MeshBasicMaterial({
                color: 6285567,
                alphaMap: tx.tm,
                transparent: !0,
                opacity: 0,
                blending: T.AdditiveBlending,
                side: T.DoubleSide,
                depthWrite: !1,
                toneMapped: !1
              });
              const sm = new T.Mesh(geo, sheen);
              sm.renderOrder = 2;
              g.add(sm);
              return {
                g,
                dm: sheen,
                sheen
              };
            };
            const wings = [ 1, -1 ].map(sd => {
              const root = new T.Group;
              root.position.set(.04 * sd, .16, -.02);
              root.scale.x = sd;
              fly.add(root);
              const f = wing(FW, 0, !1), h = wing(HW, 0, !0), hg = new T.Group;
              f.g.position.z = .004;
              f.g.children.forEach(o => o.renderOrder = 3);
              hg.position.z = -.004;
              root.add(f.g);
              hg.add(h.g);
              root.add(hg);
              return {
                root,
                hg,
                fore: f.dm,
                hind: h.dm,
                sheens: [ f.sheen, h.sheen ]
              };
            });
            const LEGS = [ [ 1, .21, 40 ], [ 1, .15, 0 ], [ 1, .09, -40 ], [ -1, .21, 140 ], [ -1, .15, 180 ], [ -1, .09, 220 ] ].map(([sd, y, a]) => {
              const seg = r => {
                const o = new T.Mesh(new T.CylinderGeometry(r, r, 1, 10), chrome);
                sc.add(o);
                return o;
              }, ball = r => {
                const o = new T.Mesh(new T.SphereGeometry(r, 14, 10), chrome);
                sc.add(o);
                return o;
              };
              return {
                sd,
                y,
                a,
                base: new T.Vector3(.07 * sd, y, .05),
                fem: seg(.008),
                tib: seg(.0055),
                knee: ball(.014),
                foot: ball(.013),
                hip: ball(.016),
                pads: [],
                tip: null
              };
            });
            const ringXY = a => [ Math.cos(a) * rx, Math.sin(a) * ry ], colXY = (k, slot) => [ (0 === k || 3 === k ? -1 : 1) * rx, (k < 2 ? 1 : -1) * ry * (.1 + .85 * slot / 5) ];
            const rx = O.vert ? 1.08 : 1.6, ry = O.vert ? 1.95 : .98, SEG = [ 48, 4, 3, 6 ], ROT = [ 0, Math.PI / 4, Math.PI / 2, 0 ], pads = [];
            for (let k = 0; k < 4; k++) FR.forEach((role, ri) => {
              const slot = FSLOT.indexOf(role), xy = O.vert ? colXY(k, slot) : null, deg = xy ? 180 * Math.atan2(xy[1], xy[0]) / Math.PI : FKA[k] + 12.5 * (slot - 2.5), a = deg * Math.PI / 180, rad = "k" === role ? .15 : "s" === role ? .12 : .085;
              const [x, y] = xy || ringXY(a), g = new T.Group;
              g.position.set(x, y, .32);
              g.rotation.z = ROT[k];
              sc.add(g);
              const out = new T.Mesh(new T.TorusGeometry(rad, .0065, 6, SEG[k]), new T.MeshBasicMaterial({
                color: 15921906
              })), m = new T.MeshBasicMaterial({
                color: 16777215,
                transparent: !0,
                opacity: 0,
                side: T.DoubleSide,
                depthWrite: !1
              });
              m.color.set([ 5227519, 6288840, 12160255, 16757596 ][k]);
              m.toneMapped = !1;
              const fill = new T.Mesh(new T.CircleGeometry(.86 * rad, SEG[k]), m);
              g.add(out, fill);
              pads[6 * k + ri] = {
                g,
                m,
                pos: new T.Vector3(x, y, .32),
                f: 0,
                leg: -1,
                deg,
                geo: out.geometry,
                rot0: ROT[k]
              };
            });
            [ [ 24, 98 ], [ 25, 82 ], [ 26, -90 ] ].forEach(([i, deg]) => {
              const a = deg * Math.PI / 180, [x, y] = O.vert ? [ [ -.32, ry ], [ .32, ry ], [ 0, -ry ] ][i - 24] : ringXY(a), g = new T.Group;
              g.position.set(x, y, .32);
              sc.add(g);
              const lm = new T.MeshBasicMaterial({
                color: 15921906
              }), m = new T.MeshBasicMaterial({
                color: 16740264,
                transparent: !0,
                opacity: 0,
                side: T.DoubleSide,
                depthWrite: !1,
                toneMapped: !1
              });
              const inner = new T.Mesh(new T.TorusGeometry(.075, .005, 6, 48), lm), outer = new T.Mesh(new T.TorusGeometry(.13, .0065, 6, 64), lm);
              g.add(outer, inner, new T.Mesh(new T.CircleGeometry(.075, 48), m));
              let best = -1, bd = 1e9;
              if (26 === i) {
                LEGS.forEach((L, j) => {
                  const d = Math.abs(((deg - L.a) % 360 + 540) % 360 - 180);
                  if (d < bd) {
                    bd = d;
                    best = j;
                  }
                });
                LEGS[best].pads.push(i);
              }
              pads[i] = {
                g,
                m,
                pos: new T.Vector3(x, y, .32),
                f: 0,
                leg: best,
                deg,
                slow: !0,
                geo: outer.geometry,
                rot0: 0,
                inner
              };
            });
            const KCOL = [ "#4fc3ff", "#5ff5c8", "#b98cff", "#ffb35c", "#ff6fa8" ];
            pads.forEach((q, i) => {
              const k = i < 24 ? Math.floor(i / 6) : 4, role = i < 24 ? FR[i % 6] : null, rad = i < 24 ? "k" === role ? .15 : "s" === role ? .12 : .085 : .13;
              const w = 4 === k ? .125 : 2 === k ? .95 * rad : 1.42 * rad, h = 4 === k ? .06 : 2 === k ? .42 * rad : .62 * rad, cv = document.createElement("canvas");
              cv.width = 192;
              cv.height = 72;
              const tex = new T.CanvasTexture(cv);
              tex.colorSpace = T.SRGBColorSpace;
              const pl = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({
                map: tex,
                transparent: !0,
                depthWrite: !1,
                toneMapped: !1
              }));
              pl.position.copy(q.pos).add(new T.Vector3(0, 2 === k ? .18 * -rad : 0, .006));
              pl.renderOrder = 4;
              sc.add(pl);
              Object.assign(q, {
                k,
                cv,
                cx: cv.getContext("2d"),
                tex,
                pl,
                col: KCOL[k],
                wn0: i < 24 ? "h" === role ? "hh_closed_vl3_rr1" : "o" === role ? "hh_open_vl3_rr1" : "syn/" + FK[k] + "_" + role : "syn/" + [ "siren", "sweep", "boom" ][i - 24],
                last: null,
                drawn: ""
              });
            });
            pads.forEach((q, i) => {
              const n = i < 24 && "k" === FR[i % 6] ? 3 : 2;
              q.rip = [];
              q.ang = 0;
              q.spin = 0;
              for (let r = 0; r < n; r++) {
                const mt = new T.MeshBasicMaterial({
                  color: new T.Color(q.col),
                  transparent: !0,
                  opacity: 0,
                  depthWrite: !1,
                  toneMapped: !1
                }), me = new T.Mesh(q.geo, mt);
                me.position.copy(q.pos).add(new T.Vector3(0, 0, -.004));
                me.rotation.z = q.rot0;
                me.visible = !1;
                sc.add(me);
                q.rip.push({
                  me,
                  mt,
                  t: -9,
                  v: 0,
                  big: 1
                });
              }
            });
            [ 1, -1 ].forEach(sd => {
              const side = [ ...Array(24).keys() ].filter(i => pads[i].pos.x * sd > 0).sort((a, b) => pads[b].pos.y - pads[a].pos.y), legs = [ ...LEGS.keys() ].filter(j => LEGS[j].sd === sd).sort((a, b) => LEGS[b].y - LEGS[a].y);
              side.forEach((i, n) => {
                const j = legs[Math.min(2, Math.floor(3 * n / side.length))];
                pads[i].leg = j;
                LEGS[j].pads.push(i);
              });
            });
            LEGS.forEach(L => {
              L.mid = new T.Vector3;
              L.pads.filter(i => i < 24).forEach(i => L.mid.add(pads[i].pos));
              L.mid.multiplyScalar(1 / Math.max(1, L.pads.filter(i => i < 24).length));
              let m = .6;
              L.pads.forEach(i => {
                m = Math.max(m, pads[i].pos.distanceTo(L.base.clone().multiplyScalar(FS)));
              });
              L.reach = 1.08 * m + .08;
            });
            Object.assign(FLY, {
              T,
              R,
              sc,
              cam,
              fly,
              ant,
              wings,
              LEGS,
              pads,
              rx,
              ry,
              FS,
              LL: O.vert ? [ 1.02, 1.1 ] : [ .82, .86 ]
            });
          }(T);
        } catch (e) {
          console.warn("butterfly 3D", e);
        }
      }).catch(() => {
        HEAD.state = "fail";
      });
    }
  }
  const KIT3 = {};
  function place(m, a, b) {
    const T = KIT3.T, d = (new T.Vector3).subVectors(b, a), L = d.length();
    m.position.copy(a).addScaledVector(d, .5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
    m.scale.set(1, L, 1);
  }
  const bowAmt = now => D.endPose && now >= D.endPose ? (x => x * x * (3 - 2 * x))(Math.min(1, (now - D.endPose) / .8)) : 0;
  const BIG = {
    frame: -1,
    cur: null,
    prev: null,
    t: 0
  };
  [ 0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5 ].map(v => (v + .5) / 16);
  const INK = {
    p: [],
    last: {},
    vort: [],
    t: 0
  };
  function inkFlow(x, y, t, W, H) {
    const u = x / W, v = y / H;
    let a = 1.7 * Math.sin(5.1 * u + .21 * t) + 1.7 * Math.cos(6.3 * v - .17 * t) + 1.3 * Math.sin(3.7 * (u + v) + .11 * t) + .6 * Math.cos(8.9 * (u - v) - .09 * t);
    return a;
  }
  function inkSpawn(x, y, n, sp, life, W) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, r = Math.random();
      INK.p.push({
        x: x + Math.cos(a) * r * W * .004,
        y: y + Math.sin(a) * r * W * .004,
        vx: Math.cos(a) * sp * (.3 + r),
        vy: Math.sin(a) * sp * (.3 + r),
        life,
        l0: life,
        b: 1
      });
    }
  }
  function drawBig(now, W = 1600, H = 276) {
    if (BIG.frame === now) return;
    BIG.frame = now;
    if (!BIG.cv) {
      BIG.cv = document.createElement("canvas");
      BIG.g = BIG.cv.getContext("2d");
    }
    if (BIG.cv.width !== W || BIG.cv.height !== H) {
      BIG.cv.width = W;
      BIG.cv.height = H;
      INK.p = [];
      BIG.g.fillStyle = "#000";
      BIG.g.fillRect(0, 0, W, H);
    }
    const g = BIG.g, U = Math.min(W, H) / 300, dt = Math.min(.05, Math.max(0, now - (INK.t || now)));
    INK.t = now;
    if (0 === dt && INK.p.length) return;
    const bs = Math.min(1, env("flat", now, 2)), ended = D.endPose && now >= D.endPose;
    const fresh2 = p => {
      const out = [];
      for (const h of D.hits[p] || []) h.t <= now && h.t > (INK.last[p] ?? now - .05) && out.push(h);
      INK.last[p] = now;
      return out;
    };
    if (FLY.padScr) {
      INK.shock = INK.shock || [];
      for (const x of D.fly) {
        if (x.t > now) break;
        if (x.t <= (INK.lastFly ?? now - .05)) continue;
        const ps = FLY.padScr[x.pad];
        if (!ps) continue;
        const px = ps[0] * W, py = ps[1] * H, c = x.pad < 24 ? Math.floor(x.pad / 6) : 4, role = x.pad < 24 ? FR[x.pad % 6] : "x", n0 = INK.p.length, N = {
          k: 110,
          s: 70,
          g: 18,
          h: 14,
          o: 40,
          p: 28,
          x: 150
        }[role];
        inkSpawn(px, py, Math.round(N * (.4 + .8 * x.v)), U * ("k" === role ? 1.6 : 1) * (.6 + x.v), "x" === role ? 3.5 : 1.6 + x.v, W);
        for (let i = n0; i < INK.p.length; i++) {
          INK.p[i].c = c;
          INK.p[i].b = .9;
        }
        "k" === role && INK.shock.push({
          x: px,
          y: py,
          t: x.t,
          v: x.v
        });
      }
      INK.lastFly = now;
      INK.shock = INK.shock.filter(q => now - q.t < .7);
    }
    fresh2("kick").forEach(h => {});
    fresh2("snare").forEach(h => {
      h.v > .5 && INK.vort.push({
        x: W * (.05 + .9 * Math.random()),
        y: H * (.08 + .84 * Math.random()),
        t: now,
        s: (Math.random() < .5 ? -1 : 1) * h.v
      });
    });
    fresh2("crash").forEach(h => {
      const x0 = W * Math.random(), y0 = H * (.2 + .6 * Math.random()), a = .8 * (Math.random() - .5);
      for (let i = 0; i < 70; i++) {
        const t2 = i / 70;
        INK.p.push({
          x: x0 + Math.cos(a) * t2 * W * .3,
          y: y0 + Math.sin(a) * t2 * W * .3,
          vx: 0,
          vy: 0,
          life: 1.4,
          l0: 1.4,
          b: .7
        });
      }
    });
    if (!ended && INK.p.length < 2700) for (let i = 0; i < 34; i++) INK.p.push({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: 0,
      vy: 0,
      life: 3 + 3 * Math.random(),
      l0: 6,
      b: .35
    });
    INK.vort = INK.vort.filter(q => now - q.t < 1.2);
    g.globalCompositeOperation = "source-over";
    g.fillStyle = `rgba(0,0,0,${ended ? .07 : .04})`;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "lighter";
    g.lineCap = "round";
    const speed = U * (.45 + 1.1 * bs), f = Math.min(2, 60 * dt), paths = [ new Path2D, new Path2D, new Path2D ], cpaths = [ 0, 1, 2, 3, 4 ].map(() => [ new Path2D, new Path2D, new Path2D ]), t = now;
    for (const q of INK.p) {
      const a = inkFlow(q.x, q.y, t, W, H);
      let vx = Math.cos(a) * speed + q.vx, vy = Math.sin(a) * speed * .7 + q.vy;
      for (const v of INK.vort) {
        const dx = q.x - v.x, dy = q.y - v.y, d2 = dx * dx + dy * dy + 400 * U * U, k = v.s * U * 900 / d2 * Math.exp(2 * -(now - v.t));
        vx += -dy * k;
        vy += dx * k;
      }
      if (INK.shock) for (const v of INK.shock) {
        const a2 = now - v.t, dx = q.x - v.x, dy = q.y - v.y, d = Math.hypot(dx, dy) + 1, R = a2 * W * .55;
        if (Math.abs(d - R) < .07 * W) {
          const k = 5 * U * (1 - a2 / .7) * v.v;
          q.vx += dx / d * k;
          q.vy += dy / d * k;
        }
      }
      const x0 = q.x, y0 = q.y;
      q.x += vx * f;
      q.y += vy * f;
      q.vx *= Math.pow(.93, f);
      q.vy *= Math.pow(.93, f);
      q.life -= dt;
      const L = q.life / q.l0, bk = L * q.b > .6 ? 2 : L * q.b > .3 ? 1 : 0, P2 = cpaths && null != q.c ? cpaths[q.c][bk] : paths[bk];
      P2.moveTo(x0, y0);
      P2.lineTo(q.x, q.y);
    }
    INK.p = INK.p.filter(q => q.life > 0 && q.x > -20 && q.x < W + 20 && q.y > -20 && q.y < H + 20);
    const ih = 215 + 35 * Math.sin(.11 * now);
    [ [ .018, .7 ], [ .032, .9 ], [ .055, 1.1 ] ].forEach(([al, lw], i) => {
      g.strokeStyle = `hsla(${ih + 12 * i},70%,${72 + 6 * i}%,${1.15 * al})`;
      g.lineWidth = lw * U;
      g.stroke(paths[i]);
    });
    cpaths && [ [ 79, 195, 255 ], [ 95, 245, 200 ], [ 185, 140, 255 ], [ 255, 179, 92 ], [ 255, 111, 168 ] ].forEach(([r, g2, b], c) => [ [ .03, .8 ], [ .055, 1 ], [ .09, 1.2 ] ].forEach(([al, lw], i) => {
      g.strokeStyle = `rgba(${r},${g2},${b},${al})`;
      g.lineWidth = lw * U;
      g.stroke(cpaths[c][i]);
    }));
    g.globalCompositeOperation = "source-over";
  }
  const FLY = {};
  const FSLOT = [ "o", "h", "s", "k", "g", "p" ], FKA = [ 140, 40, -40, -140 ];
  const CODE = {
    bar: -1,
    rows: null
  };
  const NOTE = {
    0: "G",
    "-2": "F",
    3: "B♭",
    "-4": "E♭",
    "-5": "D",
    7: "D",
    8: "E♭",
    "-7": "C",
    5: "C",
    2: "A",
    "-1": "G♭"
  };
  function drawFly(V, now, g, w, h) {
    const bw = Math.max(2, w >> 1), bh = Math.max(2, h >> 1);
    drawBig(now, bw, bh);
    if (!FLY.bgc || FLY.bgc.width !== bw || FLY.bgc.height !== bh) {
      FLY.bgc = document.createElement("canvas");
      FLY.bgc.width = bw;
      FLY.bgc.height = bh;
      FLY.bgx = FLY.bgc.getContext("2d");
    }
    const bg = FLY.bgx;
    bg.globalCompositeOperation = "copy";
    bg.drawImage(BIG.cv, 0, 0);
    bg.globalCompositeOperation = "source-over";
    {
      const vg = bg.createRadialGradient(bw / 2, bh / 2, .5 * Math.min(bw, bh), bw / 2, bh / 2, .8 * Math.max(bw, bh));
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,.3)");
      bg.fillStyle = vg;
      bg.fillRect(0, 0, bw, bh);
    }
    {
      const w = bw, h = bh, g = bg;
      const bE = Math.min(1, env("flat", now, 2)), kE = Math.min(1, env("kick", now, 6)), hE = Math.min(1, env("hh", now, 10)), cx = w / 2, cy = h / 2, R = .55 * Math.min(w, h), gl = g.createRadialGradient(cx, cy, 0, cx, cy, R);
      gl.addColorStop(0, `rgba(40,130,255,${.16 * bE + .06 * kE})`);
      gl.addColorStop(.5, `rgba(70,60,200,${.07 * bE})`);
      gl.addColorStop(1, "rgba(0,0,0,0)");
      g.globalCompositeOperation = "lighter";
      g.fillStyle = gl;
      g.fillRect(0, 0, w, h);
      {
        const sy = h > w ? .47 * h : .52 * h, bl = g.createRadialGradient(cx, sy, 0, cx, sy, Math.max(w, h) * (h > w ? .42 : .36)), br = .3 + .04 * Math.sin(.8 * now) + .05 * kE;
        bl.addColorStop(0, `rgba(120,140,178,${br})`);
        bl.addColorStop(.5, `rgba(85,100,140,${.6 * br})`);
        bl.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = bl;
        g.fillRect(0, 0, w, h);
      }
      FLY.dust || (FLY.dust = Array.from({
        length: 160
      }, () => ({
        x: Math.random(),
        y: Math.random(),
        z: Math.random(),
        ph: Math.random() * TAU
      })));
      const U2 = Math.min(w, h) / 600, dt = Math.min(.05, Math.max(0, now - (FLY.dT || now)));
      FLY.dT = now;
      const blow = .012 * Math.max(0, -(FLY.flapV || 0));
      const DB = [];
      for (const d of FLY.dust) {
        const dx = d.x - .5, dy = d.y - .5, r = Math.hypot(dx, dy) + .02;
        d.x += (.004 * Math.sin(.2 * now + d.ph) + dx / r * blow * (1 - r)) * dt * (.4 + d.z);
        d.y += (-.012 - .01 * d.z + dy / r * blow * (1 - r)) * dt * (.4 + d.z);
        if (d.y < -.02) {
          d.y = 1.02;
          d.x = Math.random();
        }
        d.x < -.02 && (d.x = 1.02);
        d.x > 1.02 && (d.x = -.02);
        d.y > 1.03 && (d.y = -.02);
        const tw = .5 + .5 * Math.sin(3 * now + 7 * d.ph), a = (.12 + .25 * d.z) * (.6 + .4 * tw) + .45 * hE * tw * d.z, bk = a > .45 ? 2 : a > .25 ? 1 : 0, rr = (.6 + 1.8 * d.z) * U2;
        (DB[bk] = DB[bk] || new Path2D).moveTo(d.x * w + rr, d.y * h);
        DB[bk].arc(d.x * w, d.y * h, rr, 0, TAU);
      }
      [ .18, .35, .6 ].forEach((a, i) => {
        if (DB[i]) {
          g.fillStyle = `rgba(220,235,255,${a})`;
          g.fill(DB[i]);
        }
      });
      g.globalCompositeOperation = "source-over";
    }
    g.globalCompositeOperation = "copy";
    g.imageSmoothingEnabled = !0;
    g.imageSmoothingQuality = "low";
    g.drawImage(FLY.bgc, 0, 0, w, h);
    g.globalCompositeOperation = "source-over";
    "idle" === HEAD.state && loadHead();
    !function drawCode(g, w, h, now) {
      if (!D.events || null == D.barT) return;
      if (CODE.bar !== D.bar) {
        CODE.bar = D.bar;
        CODE.rows = function codeRows() {
          const ev = D.events || [], row = () => Array(16).fill("."), kits = [ 0, 1, 2, 3 ].map(row), rank = {
            k: 6,
            s: 5,
            o: 4,
            h: 3,
            g: 2,
            p: 1
          }, bass = row(), fx = row();
          for (const e of ev) {
            const st = Math.max(0, Math.min(15, Math.floor(4 * e.o + 1e-6)));
            if ("fp" === e.p) {
              const cur = kits[e.k][st];
              ("." === cur || rank[e.r] > (rank[cur] || 0)) && (kits[e.k][st] = e.r);
            } else "kb" === e.p && "bass" === e.who ? bass[st] = NOTE[e.semi] ?? "G" : "jl" === e.p && null != e.fpad && (fx[st] = e.n.slice(4, 5));
          }
          return {
            kits,
            bass,
            fx
          };
        }();
      }
      const R = CODE.rows, st = Math.floor((now - D.barT) / sd()), S = D.sec || {}, vert = h > w, fs = Math.round(Math.min(w, h) * (vert ? .019 : .0165)), lh = 1.38 * fs, KC = [ "#4fc3ff", "#5ff5c8", "#b98cff", "#ffb35c" ];
      const reveal = Math.max(0, Math.min(1, (now - D.barT) / .22)), log = [];
      for (let i = D.fly.length - 1; i >= 0 && log.length < (h > w ? 3 : 6); i--) {
        const x = D.fly[i];
        x.t <= now && log.push(x);
      }
      const lines = [ {
        t: `// ${String(S.name || "").toLowerCase()} · bar ${(D.bi ?? 0) + 1}/${S.bars || "?"} · 170 bpm · chop ${knob("brain.chop").toFixed(2)}`,
        c: null
      }, ...R.kits.map((k, i) => ({
        t: `kit${"ABCD"[i]} = "`,
        p: k,
        c: KC[i]
      })), {
        t: 'bass = "',
        p: R.bass,
        c: "#9fc8ff"
      }, {
        t: 'fx   = "',
        p: R.fx,
        c: "#ff6fa8"
      }, {
        t: "→ " + log.map(x => x.pad < 24 ? "ABCD"[Math.floor(x.pad / 6)] + "." + FR[x.pad % 6] + " " + x.v.toFixed(2) : [ "siren", "sweep", "boom" ][x.pad - 24]).join("   "),
        c: null
      } ];
      g.save();
      g.font = `${fs}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
      g.textBaseline = "alphabetic";
      const cw = g.measureText("M").width;
      const bw = Math.max(...lines.map(L => L.p ? L.t.length + 17 : L.t.length)) * cw, x0 = vert ? (w - bw) / 2 : .022 * w, y0 = (vert ? .83 * h : h - .035 * h) - lh * (lines.length - 1);
      lines.forEach((L, li) => {
        const y = y0 + li * lh;
        if (!L.p) {
          const n = 0 === li ? Math.round(L.t.length * reveal) : L.t.length;
          g.fillStyle = 0 === li ? "rgba(200,210,225,.5)" : "rgba(220,230,240,.42)";
          g.fillText(L.t.slice(0, n), x0, y);
          return;
        }
        g.fillStyle = "rgba(200,210,225,.5)";
        g.fillText(L.t, x0, y);
        const px = x0 + L.t.length * cw, shown = Math.round(16 * reveal);
        for (let j = 0; j < shown; j++) {
          const ch = L.p[j], x = px + j * cw, hitNow = j === st && "." !== ch;
          g.fillStyle = hitNow ? L.c : "." === ch ? "rgba(200,210,225,.25)" : j < st ? "rgba(230,236,245,.62)" : "rgba(230,236,245,.45)";
          g.fillText(ch[0], x, y);
          if (ch.length > 1) {
            g.save();
            g.font = `${Math.round(.6 * fs)}px ui-monospace, Menlo, Consolas, monospace`;
            g.fillText(ch.slice(1), x + .62 * cw, y - .38 * fs);
            g.restore();
          }
        }
        g.fillStyle = "rgba(200,210,225,.5)";
        g.fillText('"', px + 16 * cw, y);
        if (st >= 0 && st < 16) {
          g.fillStyle = "rgba(255,255,255,.1)";
          g.fillRect(px + st * cw - 1, y - .85 * fs, cw + 2, 1.05 * fs);
        }
      });
      g.restore();
    }(g, w, h, now);
    if (FLY.R) try {
      !function renderFly(now, w, h) {
        const K = FLY, T = K.T, V3 = (x, y, z) => new T.Vector3(x, y, z);
        K.R.domElement.width === w && K.R.domElement.height === h || K.R.setSize(w, h, !1);
        const asp = w / h, tn = Math.tan(15 * Math.PI / 180), dist = 1.02 * Math.max((K.ry + .32) / tn, (K.rx + .3) / (tn * asp));
        if (K.cam.aspect !== asp) {
          K.cam.aspect = asp;
          K.cam.updateProjectionMatrix();
        }
        K.cam.position.set(0, .04, dist);
        K.cam.lookAt(0, 0, 0);
        K.cam.updateMatrixWorld();
        K.padScr = K.pads.map(q => {
          const v = q.pos.clone().project(K.cam);
          return [ (v.x + 1) / 2, (1 - v.y) / 2 ];
        });
        bowAmt(now);
        const kE = Math.min(1, env("kick", now, 6)), sE = Math.min(1, env("snare", now, 6)), hE = Math.min(1, env("hh", now, 9)), bE = Math.min(1, env("flat", now, 2));
        const te = D.endPose && now >= D.endPose ? now - D.endPose : 0, ramp = Math.min(1, te / .5);
        K.fly.position.set(0, .03 * Math.sin(1.3 * now) + .025 * kE + .04 * ramp * Math.sin(2.2 * te), 0);
        K.fly.rotation.z = 0;
        K.fly.updateMatrixWorld(!0);
        const idle = .22 + .16 * Math.sin(2.3 * now) + .3 * kE + .12 * bE, slow = .15 + .95 * (.5 - .5 * Math.cos(2.2 * te)), flap = te ? idle * (1 - ramp) + slow * ramp : idle;
        {
          const dtf = Math.max(.001, now - (K.fPrevT || now - .016));
          K.flapV = (flap - (K.flapPrev ?? flap)) / dtf;
          K.flapPrev = flap;
          K.fPrevT = now;
        }
        K.wings.forEach((W, i) => {
          W.root.rotation.y = (0 === i ? 1 : -1) * flap;
          W.hg.rotation.y = te ? .15 * Math.sin(2.2 * te - .6) : .12 * Math.sin(2.3 * now - .7);
          const sh = .03 + .28 * Math.pow(Math.abs(Math.sin(2.4 * flap + .6 * now + i)), 4);
          W.sheens.forEach((m, k) => {
            m.opacity = Math.min(.55, sh + (k ? .18 * kE : .28 * sE));
            m.color.setHSL(.52 + .04 * Math.sin(.4 * now + 2 * flap), .95, .6);
          });
        });
        K.ant.forEach((A, i) => {
          const base = K.fly.localToWorld(V3(.02 * A.sd, .328, .015)), rest = K.fly.localToWorld(V3(A.sd * (.3 + .03 * Math.sin(1.7 * now + i) + .04 * hE), 1.02 + .02 * Math.sin(1.3 * now + i), .04));
          let prev = null, next = null;
          for (const x of D.fly) if (x.pad === A.pad) {
            if (!(x.t <= now)) {
              next = x;
              break;
            }
            prev = x;
          }
          const pp = K.pads[A.pad].pos;
          let tg;
          tg = next && next.t - now < .14 ? pp.clone().add(V3(0, -.03, .06 + .9 * (next.t - now))) : prev && now - prev.t < .3 ? pp.clone().add(V3(0, -.03, .04 + .8 * (now - prev.t))) : rest;
          A.cur = A.cur ? A.cur.lerp(tg, .35) : tg.clone();
          const d = A.cur.clone().sub(base), len = d.length(), side = V3(-d.y, d.x, 0).normalize().multiplyScalar(A.sd * len * .05), pos = A.geo.attributes.position;
          for (let k = 0; k <= 20; k++) {
            const u = k / 20;
            pos.setXYZ(k, base.x + d.x * u + side.x * Math.sin(u * Math.PI), base.y + d.y * u + side.y * Math.sin(u * Math.PI), base.z + d.z * u);
          }
          pos.needsUpdate = !0;
          A.geo.computeBoundingSphere();
          A.tip.position.copy(A.cur);
        });
        K.pads.forEach(q => q.f *= q.slow ? .99 : .84);
        for (const x of D.fly) if (x.t <= now && now - x.t < .05) {
          const q = K.pads[x.pad];
          q && (q.f = Math.max(q.f, x.v));
        }
        K.pads.forEach(q => {
          q.m.opacity = .45 * q.f;
          q.g.scale.setScalar(1 + .18 * q.f);
          q.pl.scale.setScalar(1 + .18 * q.f);
        });
        const dt = Math.min(.05, Math.max(0, now - (K.tPrev || now)));
        K.tPrev = now;
        for (const x of D.fly) {
          if (x.t > now) break;
          const q = K.pads[x.pad];
          if (q && (!q.last || x.t > q.last.t)) {
            q.last = x;
            const r0 = q.rip.reduce((a, b) => b.t < a.t ? b : a);
            Object.assign(r0, {
              t: x.t,
              v: x.v,
              big: 1
            });
            if (q.rip.length > 2 && x.v > .6) {
              const r1 = q.rip.filter(r => r !== r0).reduce((a, b) => b.t < a.t ? b : a);
              Object.assign(r1, {
                t: x.t + .06,
                v: .7 * x.v,
                big: 2.2
              });
            }
            q.spin += (4 === q.k ? 0 : 1) * (1.5 + 3 * x.v) * (q.k % 2 ? -1 : 1);
          }
        }
        K.pads.forEach(q => {
          if (1 === q.k || 2 === q.k || 3 === q.k) {
            q.ang += ([ 0, .25, -.18, .12 ][q.k] + q.spin) * dt;
            q.spin *= Math.pow(.04, dt);
            q.g.rotation.z = q.rot0 + q.ang;
          }
          q.rip.forEach(r => {
            const a = now - r.t, L = .5 * r.big;
            if (a < 0 || a > L) {
              r.me.visible = !1;
              return;
            }
            const u = a / L;
            r.me.visible = !0;
            r.me.scale.setScalar(1 + u * (.9 + .9 * r.v) * (r.big > 1 ? 1.6 : 1));
            r.me.rotation.z = q.g.rotation.z;
            r.mt.opacity = .75 * Math.pow(1 - u, 2) * Math.min(1, .3 + r.v);
          });
          if (q.inner) {
            const L = q.last, on = L && now - L.t < L.dur;
            q.inner.scale.setScalar(on ? 1 + .18 * Math.sin(9 * (now - L.t)) * (1 - (now - L.t) / L.dur) : 1);
          }
        });
        K.pads.forEach(q => {
          const L = q.last, wn = L && L.wn || q.wn0, prog = L ? (now - L.t) / Math.max(.05, L.dur) : 9, key = prog < 1.02 ? "p" : "i" + wn;
          if (key === q.drawn && "p" !== key) return;
          const W = D.wave[wn], pk = D.peak[wn];
          if (!W || !pk) return;
          q.drawn = key;
          const c = q.cx;
          c.clearRect(0, 0, 192, 72);
          for (let j = 0; j < 48; j++) {
            let a = 0;
            for (let u = Math.floor(j * W.length / 48); u < Math.floor((j + 1) * W.length / 48); u++) a = Math.max(a, W[u]);
            const hh = Math.max(1.5, 72 * Math.pow(a / pk, .7) * .46), lit = prog < 1.02 && j / 48 <= prog;
            c.fillStyle = lit ? "#ffffff" : prog < 1.02 ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.3)";
            c.fillRect(4 * j + .72, 36 - hh, 2.56, 2 * hh);
          }
          if (prog < 1.02) {
            const x = 192 * Math.min(1, prog);
            c.fillStyle = q.col;
            c.fillRect(x - 1.5, 2, 3, 68);
          }
          q.tex.needsUpdate = !0;
        });
        K.LEGS.forEach((L, j) => {
          let prev = null, next = null;
          for (const x of D.fly) if (K.pads[x.pad]?.leg === j) {
            if (!(x.t <= now)) {
              next = x;
              break;
            }
            prev = x;
          }
          const base = L.base.clone().multiplyScalar(K.FS).add(K.fly.position), rest = (Math.atan2(L.mid.y, L.mid.x), 
          V3(.82 * L.mid.x, .82 * L.mid.y + .04 * Math.sin(1.9 * now + j), .45));
          let tg;
          tg = next && next.t - now < .11 ? K.pads[next.pad].pos.clone().add(V3(0, 0, .015 + 1.1 * (next.t - now))) : prev && now - prev.t < .16 ? K.pads[prev.pad].pos.clone().add(V3(0, 0, .015 + 1.3 * (now - prev.t))) : rest;
          const near = next && next.t - now < .11 || prev && now - prev.t < .05;
          L.tip = L.tip ? L.tip.lerp(tg, near ? .85 : .5) : tg.clone();
          const pole = V3(L.sd, .35 * Math.sign(L.mid.y || 1), .6), dl = 1.07 * Math.max(.3, base.distanceTo(L.tip)), r = function ik2(S, Hd, pole, L1, L2) {
            const T = FLY.T, d = (new T.Vector3).subVectors(Hd, S), D2 = Math.min(d.length(), L1 + L2 - .001), dir = d.clone().normalize(), hand = S.clone().addScaledVector(dir, D2);
            const a = (L1 * L1 - L2 * L2 + D2 * D2) / (2 * D2), hh = Math.sqrt(Math.max(0, L1 * L1 - a * a)), p = pole.clone();
            p.addScaledVector(dir, -p.dot(dir)).normalize();
            return {
              knee: S.clone().addScaledVector(dir, a).addScaledVector(p, hh),
              hand
            };
          }(base, L.tip, pole, .49 * dl, .51 * dl);
          place(L.fem, base, r.knee);
          place(L.tib, r.knee, r.hand);
          L.knee.position.copy(r.knee);
          L.foot.position.copy(r.hand);
          L.hip.position.copy(base);
        });
        K.R.render(K.sc, K.cam);
      }(now, w, h);
      g.globalCompositeOperation = "source-over";
      g.drawImage(FLY.R.domElement, 0, 0, w, h);
    } catch (e) {
      console.warn(e);
    }
  }
  const JV = {
    kick: [ "KICKS~", "one per kit", "kick × 4" ],
    snare: [ "SNARES~", "one per kit", "snare × 4" ],
    hh: [ "HATS~", "closed, one per kit", "hat × 4" ],
    htom: [ "PERC~", "threes against four", "perc × 4" ],
    ltom: [ "GHOSTS~", "soft snares on the off 16ths", "ghost × 4" ],
    ride: [ "OPEN HATS~", "choked by the closed hats", "open × 4" ],
    crash: [ "FX~", "boom and sweep", "fx × 2" ],
    flat: [ "BASS~", "sub and reese, single notes in G minor", "sub × 2 + reese" ],
    vox: [ "SIREN~", "the siren", "siren × 1" ],
    bass: [ "REESE~", "(through BASS)", "—" ]
  };
  const voice = (id, title, sub, lab) => (JV[id] && ([title, sub, lab] = JV[id]), 
  {
    id,
    title,
    sub,
    voice: id,
    h: 150,
    nodes: [ [ "r", "obj", 8, 10, "r " + id ], [ "tg", "tgl", 260, 10 ], [ "smp", "obj", 8, 44, lab ], [ "hit", "bng", 8, 80 ], [ "vel", "obj", 40, 80, "velocity → layer, rr" ], [ "out", "obj", 8, 116, "s~ " + CHAN[id] ] ],
    wires: [ [ "r", "smp" ], [ "smp", "hit" ], [ "hit", "vel" ], [ "vel", "out", 1 ] ]
  });
  const P = Object.assign(hostP(O), {
    id: "butterfly",
    num: "21",
    title: "BUTTERFLY",
    bpm: 170,
    seed: 1,
    vinyl: !1,
    readLabels: [ "PHRASE", "NOTES/BAR" ],
    tag: "SIX LEGS · FOUR KITS · 24 PADS · 170 BPM · MASTERED · PATCH 21",
    style: "Jungle · one-shots only",
    key: "G minor · a butterfly drummer",
    blurb: "A butterfly that drums. Its six legs play 24 pads in a halo round it: four jungle kits of six one-shots each (kick, snare, ghost, hat, open hat, perc), told apart by shape: circles, squares, triangles and hexagons. Every sound is a single hit, played live: an intro of percussion in threes, a build into the Think break, a drop on the Amen, a section where the break hops to the next kit every beat, a break, a second drop that changes kit every bar with cascades running round the ring, and a last hit on all four kits at once while the wings fold.",
    maths: "Every drum is a one-shot placed on a sixteenth (or a 32nd, or a sextuplet) by the generator. The main break is written out from the Amen, Think and roller patterns; with a probability set by the chop knob a beat is replaced by another beat of the same pattern. Under it run three-against-four percussion (a hit every third sixteenth, so the accent walks across the bar and lines up again every three bars), ghost notes on the off sixteenths, ratchets in sextuplets, and cascades: 32nds that step kit to kit round the ring. Each pad belongs to the leg that points closest to it, so the drawing follows the pattern exactly.",
    sound: "All synthesised in code: 24 drum hits in four kits (kick, snare, ghost and a percussion voice each: rim, block, shaker, tom), a sub and a reese bass played as single notes and repitched, a siren, a boom and a sweep. The hats are from the Virtuosity Drums kit (CC0).",
    assets: [ ...NAMES.map(url) ],
    sections: [ {
      name: "Intro",
      bars: 2,
      kind: "fintro",
      I: .4,
      label: "a siren, gentle taps round the ring, perc in threes"
    }, {
      name: "Build",
      bars: 4,
      kind: "fbuild",
      I: .65,
      label: "the Think break, a sweep, a run round the ring"
    }, {
      name: "Drop",
      bars: 8,
      kind: "fdrop",
      I: .9,
      label: "Amen on kit A, hats from B, threes on D, sub bass"
    }, {
      name: "Kit hop",
      bars: 4,
      kind: "fhop",
      I: .95,
      label: "every beat on the next kit, reese, ratchets"
    }, {
      name: "Break",
      bars: 4,
      kind: "fbreak",
      I: .55,
      label: "long sub, open hats, the siren again"
    }, {
      name: "Drop 2",
      bars: 8,
      kind: "fdrop2",
      I: 1,
      label: "a new kit every bar, cascades round all four"
    }, {
      name: "End",
      bars: 2,
      kind: "finale",
      I: 1,
      label: "the last run · all four kits at once · wings fold"
    } ],
    monitors,
    mix: PIECES.map(p => CHAN[p]),
    mixDef: {
      fkick: {
        rev: 0,
        dly: 0
      },
      fsnare: {
        rev: .06,
        dly: 0
      },
      fhat: {
        rev: .03,
        dly: 0,
        pan: -.15
      },
      fperc: {
        rev: .1,
        dly: .08,
        pan: .2
      },
      fghost: {
        rev: .05,
        dly: 0,
        pan: -.05
      },
      fopen: {
        rev: .05,
        dly: 0,
        pan: .25
      },
      ffx: {
        rev: .2,
        dly: .15
      },
      fbass: {
        rev: 0,
        dly: 0
      },
      fsiren: {
        rev: .3,
        dly: .25
      },
      freese: {
        rev: 0,
        dly: 0
      }
    },
    masterDef: {
      eq: {
        on: !0,
        lo: 2,
        mid: 1.5,
        hi: 1.5
      },
      glue: {
        on: !0,
        thr: -20,
        rat: 2.5,
        mk: 2
      },
      sat: {
        on: !1,
        drv: 0,
        mix: 1,
        type: "over"
      },
      lim: {
        on: !0,
        gain: .9,
        ceil: -2.2
      },
      lufs: {
        target: -10,
        trim: -1.2
      }
    },
    modules: [ P1.modules[0], {
      id: "move",
      title: "MIDI CONTROLLER",
      sub: "Pads pick scenes, encoders play the band",
      h: 290,
      nodes: [ [ "dev", "move", 8, 6, "", 284, 134 ], [ "mi", "obj", 8, 152, "midiin" ], [ "rst", "msg", 160, 152, "reset" ], [ "nt", "obj", 8, 186, "notein 36 / 68" ], [ "cc", "obj", 150, 186, "ctlin 71–78" ], [ "sc", "obj", 8, 220, "pad → scene $1" ], [ "n", "num", 150, 220, "0", 4 ], [ "pl", "obj", 8, 254, "CC 85 → play" ], [ "k1", "obj", 150, 254, "enc 1–3 → band" ], [ "k8", "obj", 212, 220, "enc 4–8" ] ],
      wires: [ [ "dev", "mi" ], [ "rst", "k1" ], [ "rst", "k8" ], [ "mi", "nt" ], [ "mi", "cc" ], [ "nt", "sc" ], [ "cc", "n" ], [ "mi", "pl" ], [ "n", "k1" ], [ "n", "k8" ] ]
    }, {
      id: "brain",
      title: "BAND",
      sub: "section → bar of loops, beat edits, seeded",
      h: 190,
      nodes: [ [ "rs", "obj", 8, 10, "r section" ], [ "rb", "obj", 120, 10, "r bar" ], [ "gen", "obj", 8, 44, "break | roll | hop" ], [ "ph", "num", 8, 80, "kit", 12 ], [ "n", "num", 8, 116, "0", 4 ], [ "c1", "cmt", 50, 128, "notes this bar" ], [ "hum", "obj", 150, 116, "humanise ±4 ms" ], [ "s", "obj", 8, 152, "s limbs" ], [ "chop", "num", 150, 10, "0.50", 4 ], [ "c2", "cmt", 196, 22, "chop" ], [ "mc", "num", 150, 44, "0.50", 4 ], [ "c3", "cmt", 196, 56, "MC" ], [ "ghost", "num", 150, 80, "0.50", 4 ], [ "c4", "cmt", 196, 92, "ghosts" ] ],
      wires: [ [ "rs", "gen" ], [ "rb", "gen" ], [ "gen", "ph" ], [ "gen", "n" ], [ "gen", "hum" ], [ "hum", "s" ], [ "chop", "gen" ], [ "mc", "gen" ], [ "ghost", "gen" ] ]
    }, voice("kick"), voice("snare"), voice("hh"), voice("htom"), voice("ltom"), voice("ride"), voice("crash"), voice("flat"), voice("vox"), voice("bass"), {
      id: "out",
      title: "DAC~",
      sub: "every pad to the master",
      h: 150,
      nodes: [ [ "r1", "obj", 8, 10, "r~ kick snare hats" ], [ "r2", "obj", 8, 44, "r~ perc fx bass" ], [ "mix", "obj", 8, 80, "+~" ], [ "dac", "obj", 8, 116, "dac~" ], [ "scope", "scope", 100, 72, "", 192, 70 ] ],
      wires: [ [ "r1", "mix", 1 ], [ "r2", "mix", 1 ], [ "mix", "dac", 1 ], [ "mix", "scope", 1 ] ]
    } ]
  });
  P.layoutDef = {
    zoom: 1,
    modules: {},
    monitors: {}
  };
  P.layoutDef.monitors["drum-fly"] = O.vert ? {
    x: 24,
    y: 18,
    bw: 560,
    bh: 995.6,
    ratio: 9 / 16
  } : {
    x: 24,
    y: 18,
    bw: 1120,
    bh: 630,
    ratio: 16 / 9
  };
  [ "move", "clock", "brain", "kick", "snare", "hh", "htom", "ltom", "ride", "crash", "flat", "vox", "bass", "out" ].forEach((id, i) => {
    P.layoutDef.modules[id] = {
      x: (O.vert ? 640 : 1180) + i % 3 * 320,
      y: 18 + 240 * Math.floor(i / 3)
    };
  });
  P.cables = [ [ "clock.tick", "brain.rb" ], [ "clock.sec", "brain.rs" ], ...PIECES.map(p => [ "brain.s", p + ".r" ]), [ "kick.out", "out.r1", 1 ], [ "snare.out", "out.r1", 1 ], [ "hh.out", "out.r1", 1 ], [ "htom.out", "out.r2", 1 ], [ "ltom.out", "out.r2", 1 ], [ "ride.out", "out.r2", 1 ], [ "crash.out", "out.r2", 1 ], [ "flat.out", "out.r2", 1 ], [ "vox.out", "out.r2", 1 ], [ "bass.out", "out.r1", 1 ], [ "move.sc", "clock.sec" ], [ "move.pl", "clock.play" ], [ "move.k1", "brain.chop" ], [ "move.k8", "out.mix" ] ];
  P.edit = {
    "brain.chop": {
      min: 0,
      max: 1,
      step: .05,
      d: 2
    },
    "brain.mc": {
      min: 0,
      max: 1,
      step: .05,
      d: 2
    },
    "brain.ghost": {
      min: 0,
      max: 1,
      step: .05,
      d: 2
    }
  };
  P.msgs = {
    "move.rst": () => {
      Object.keys(P.edit).forEach(k => setHold(k, null));
      flash("move.k1");
      flash("move.k8");
      moveSay("reset");
      moveUI();
    }
  };
  P.play = (t, bar, s, S, ui) => {
    load();
    if (!D.ok) return;
    if (0 === s || D.bar !== bar) {
      const bi = bar - SEC_START[PATCH.sections.indexOf(S)];
      D.bar = bar;
      D.events = function barEvents(bar, S, bi) {
        return function flyEvents(bar, S, bi) {
          const r = (s => {
            let a = s >>> 0;
            return () => {
              a = a + 1831565813 >>> 0;
              let t = a;
              t = Math.imul(t ^ t >>> 15, 1 | t);
              t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
              return ((t ^ t >>> 14) >>> 0) / 4294967296;
            };
          })(7919 * seedR + 104729 * bar + 31), E = [], k = S.kind;
          D.kind = k;
          D.lastBar = bi === S.bars - 1;
          D.soloBar = !1;
          const fx = (n, len, o = 0, kind = "fx", ch = "crash", g = 1) => E.push({
            p: "jl",
            kind,
            n: "syn/" + n,
            off: 0,
            len,
            o,
            ch,
            g,
            fpad: FXPAD[n]
          });
          const bass = (pat, n = "sub", g = 1) => FBL[pat].forEach(([st, semi, ln]) => E.push({
            p: "kb",
            who: "bass",
            n: "syn/" + n,
            semi,
            len: ln / 4,
            o: st / 4,
            keys: [ semi + 7 ],
            v: .9,
            g
          }));
          const longb = (semi, len, n = "sub") => E.push({
            p: "kb",
            who: "bass",
            n: "syn/" + n,
            semi,
            len,
            o: 0,
            keys: [ semi + 7 ],
            v: .8
          });
          const fills = knob("brain.mc");
          switch (k) {
           case "fintro":
            ((E, r, bi) => {
              const roles = [ "h", "g", "p", "h", "g", "h", "p", "g" ];
              for (let i = 0; i < 8; i++) {
                const k = (i + 3 * bi) % 4, ro = roles[(i + bi) % 8];
                3 === k && "p" === ro || FH(E, k, ro, .14 + .1 * r() + .04 * bi, i / 2 + (i % 2 ? .04 * r() : 0));
              }
            })(E, r, bi);
            ftrip(E, 3, .45 + .1 * bi);
            for (let i = 0; i < 8; i++) FH(E, 3, "h", (i % 2 ? .3 : .55) * (.8 + .4 * r()), i / 2);
            0 === bi && fx("siren", 16, 0, "voc", "vox");
            if (bi >= 1) for (let i = 1; i < 16; i += 2) r() < .5 && FH(E, 2, "g", .2 + .1 * r(), i / 4);
            if (bi === S.bars - 1) {
              ((E, k, from, beats, r = "s") => {
                const n = Math.round(4 * beats);
                for (let i = 0; i < n; i++) FH(E, k, r, .3 + .6 * i / n, from + i / 4);
                for (let i = 0; i < 4; i++) FH(E, k, r, .75 + .06 * i, from + beats - .5 + i / 8);
              })(E, 2, 2, 2);
              FH(E, 0, "k", .8, 0);
            }
            D.phrase = "four kits wake";
            break;

           case "fbuild":
            fbrk(E, r, 0, "think", .1, {
              soft: .8,
              hk: 1
            });
            0 === bi && fx("sweep", 16, 0);
            bi % 2 == 0 && longb(0, 2);
            if (bi === S.bars - 1) {
              for (let q = E.length - 1; q >= 0; q--) E[q].o >= 2 && "fp" === E[q].p && E.splice(q, 1);
              fcascade(E, 2, 2);
            }
            D.phrase = "build";
            break;

           case "fdrop":
            fbrk(E, r, 0, "amen", .18 + bi % 4 * .06, {
              hk: 1
            });
            ftrip(E, 3, .5);
            for (let i = 1; i < 16; i += 2) r() < .35 * fills * 2 && FH(E, 1, "g", .22 + .12 * r(), i / 4);
            bass(bi % 4 == 3 ? "b" : "a");
            if (0 === bi) {
              fx("boom", 8, 0, "fx", "crash", 1.2);
              FH(E, 2, "o", .8, 0);
            }
            if (bi % 4 == 3) if (r() < .5) fratchet(E, 2); else {
              for (let q = E.length - 1; q >= 0; q--) "fp" === E[q].p && E[q].o >= 3 && E.splice(q, 1);
              fcascade(E, 3, 1);
            }
            if (bi % 2 == 1) for (let i = 2; i < 16; i += 4) FH(E, 2, "o", .35, i / 4);
            if ("Hook" === S.name) {
              for (let q = E.length - 1; q >= 0; q--) "fp" === E[q].p && E[q].o >= 3 && E.splice(q, 1);
              fcascade(E, 3, 1, "kssk");
            }
            D.phrase = "Hook" === S.name ? "hook" : "drop";
            break;

           case "fhop":
            !function fhop(E, r, name, order) {
              order.forEach((k, q) => fbrk(E, r, k, name, .15, {
                from: q,
                to: q + 1,
                hk: (k + 1) % 4
              }));
            }(E, r, bi % 2 ? "think" : "amen", bi % 2 ? [ 3, 2, 1, 0 ] : [ 0, 1, 2, 3 ]);
            longb(bi % 2 ? 3 : 0, 4, "reese");
            bi % 2 == 1 && fratchet(E, (bi + 2) % 4);
            ftrip(E, 3, .4, "h");
            D.phrase = "kit hop";
            break;

           case "fbreak":
            ftrip(E, 3, .4);
            for (let i = 2; i < 16; i += 4) FH(E, 2, "o", .3, i / 4);
            bi % 2 == 0 && longb(2 === bi ? -4 : 0, 8);
            0 === bi && fx("siren", 16, 0, "voc", "vox", .8);
            if (3 === bi) {
              fcascade(E, 2, 2, "gsgs");
              fx("sweep", 8, 2, "fx", "crash", .8);
            }
            D.phrase = "break";
            break;

           case "fdrop2":
            {
              const kk = [ 0, 1, 2, 3 ][bi % 4];
              fbrk(E, r, kk, bi % 2 ? "roller" : "amen", .35, {
                hk: (kk + 1) % 4
              });
              ftrip(E, (kk + 3) % 4, .5);
              for (let i = 1; i < 16; i += 2) r() < .45 * fills * 2 && FH(E, (kk + 2) % 4, "g", .2 + .15 * r(), i / 4);
              bi % 4 < 2 ? bass("b") : longb(bi % 2 ? -2 : 0, 4, "reese");
              if (0 === bi || 4 === bi) {
                fx("boom", 8, 0, "fx", "crash", 1.2);
                FH(E, kk, "o", .8, 0);
              }
              if (bi % 2 == 1) {
                for (let q = E.length - 1; q >= 0; q--) "fp" === E[q].p && E[q].o >= 3 && E.splice(q, 1);
                fcascade(E, 3, 1, bi % 4 == 3 ? "kssk" : "ssgs");
              }
              D.phrase = "drop 2 · kit " + "ABCD"[kk];
              break;
            }

           case "finale":
            if (bi < S.bars - 1) {
              bass("c");
              fbrk(E, r, 0, "amen", .3, {
                to: 2,
                hk: 1
              });
              fcascade(E, 2, 2, "kssh");
              D.phrase = "last run";
            } else {
              [ 0, 1, 2, 3 ].forEach(kk => {
                FH(E, kk, "k", 1, 0);
                FH(E, kk, "s", .9, 0);
                FH(E, kk, "o", .7, 0);
              });
              longb(0, 6);
              fx("boom", 8, 0, "fx", "crash", 1.3);
              D.phrase = "the end";
            }
          }
          E.sort((a, b) => a.o - b.o);
          D.notes = E.filter(e => !e.silent).length;
          return E;
        }(bar, S, bi);
      }(bar, S, bi);
      D.barT = t;
      D.bi = bi;
      D.sec = S;
      "finale" === S.kind && bi === S.bars - 1 && (D.endPose = t + .35);
      ui.push([ "brain.gen" ]);
      const cut = !1, cutBars = "count" === S.kind || "shuffle" === S.kind || "solo" === S.kind ? 2 : 1;
      if (cut) {
        const dur = 16 * sd() * cutBars;
        D.cuts.push("finale" === S.kind ? {
          t0: t,
          tc: t + dur + 1.6,
          t1: t + dur + 6,
          kind: S.kind
        } : {
          t0: t,
          t1: t + dur,
          kind: S.kind
        });
        D.cuts.length > 12 && D.cuts.shift();
      }
    }
    const step = sd(), beat = 4 * step;
    for (const e of D.events) e.o >= s / 4 - 1e-9 && e.o < (s + 1) / 4 - 1e-9 && strike(e, t + (e.o - s / 4) * beat, ui);
  };
  P.recordCanvas = on => {
    if (on) {
      const V = (D.views || []).find(v => "fly" === v.p);
      if (V) {
        D.recW = {
          _: 300,
          fly: O.vert ? 1080 : 1920
        };
        D.recSelf = !0;
        D.rec = V.canvas;
        V.canvas.width = O.vert ? 1080 : 1920;
        V.canvas.height = O.vert ? 1920 : 1080;
        return D.rec;
      }
    }
    D.recSelf = !1;
    if (on) {
      const land = !O.vert && !0;
      D.rec = document.createElement("canvas");
      [D.rec.width, D.rec.height] = land ? [ 1920, 1080 ] : [ 1080, 1920 ];
      D.recW = {
        _: 300,
        fly: O.vert ? 1080 : 1920
      };
      return D.rec;
    }
    D.rec = null;
    D.recW = null;
  };
  P.frameExport = {
    begin() {
      D.offline = !0;
    },
    end() {
      D.offline = !1;
    },
    frame(now) {
      D.views || monitors();
      renderAt(now);
    }
  };
  P.read = () => [ D.phrase || "—", String(D.notes) ];
  P.secLabel = S => S.label;
  P.ui = () => {
    setNum("brain.ph", D.phrase || "—");
    setNum("brain.n", String(D.notes));
  };
  const clear = () => {
    PIECES.forEach(p => D.hits[p] = []);
    D.mc = {
      lv: [],
      pads: []
    };
    D.kb = {
      bass: [],
      keys: []
    };
    D.fly = [];
    D.endPose = 0;
    "go" === D.recHold && (D.recHold = !1);
    D.cuts = [];
    (D.views || []).forEach(V => {
      V.st && (V.st.planets = null);
    });
    FX.comets = [];
    FX.waves = [];
    FX.links = [];
    FX.white = -9;
    FX.last = {
      p: "fly",
      t: -9
    };
    D.limbs = {
      L: [],
      R: [],
      RF: [],
      LF: []
    };
    D.lastHand = {
      L: -9,
      R: -9
    };
    D.bar = -1;
    D.openHat = null;
    D.crashes = [];
    (D.views || []).forEach(V => {
      V.st = {
        parts: [],
        rings: [],
        last: 0
      };
    });
  };
  P.reset = () => {
    clear();
    seedR = P.seed;
    load();
    loadHead();
  };
  P.jump = () => {
    clear();
  };
  P.onStop = at => {
    ctx && (at || ctx.currentTime);
  };
  P.reseed = () => {
    P.seed = 1 + Math.floor(999 * Math.random());
    seedR = P.seed;
    D.bar = -1;
    return P.seed;
  };
  addEventListener("DOMContentLoaded", () => {
    if ("object" == typeof MIXNAME) for (const [k, v] of Object.entries({
      fkick: "KICKS",
      fsnare: "SNARES",
      fhat: "HATS",
      fperc: "PERC",
      fghost: "GHOSTS",
      fopen: "OPEN HATS",
      ffx: "FX",
      fbass: "BASS",
      fsiren: "SIREN",
      freese: "REESE"
    })) MIXNAME[k] ??= v;
  });
  if (MS) {
    const M = P.layoutDef.monitors;
    for (const k of Object.keys(M)) {
      M[k + MS] = M[k];
      delete M[k];
    }
  }
  O.host && (O.host._snaps[O.fmt] = {
    ...P
  });
  return P;
}
const P22=dualFormat({id:'butterfly',num:'21',title:'BUTTERFLY'},[['16:9',{fly:true,jungle:true,land:true}],['9:16',{fly:true,jungle:true,land:true,vert:true}]],makeButterfly);
