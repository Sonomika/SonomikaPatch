/* One patch, two formats (16:9 and 9:16). make(O) builds the patch into the host object H for each format;
   setFormat swaps the snapshot in. Shared by any patch that offers a format selector. */
function hostP(O){const H=O.host;if(!H)return {};for(const k of Object.keys(H))if(k!=='_snaps')delete H[k];return H;}
function dualFormat(meta,builds,make){const H={_snaps:{}},keep=['_snaps','formats','format','setFormat'];
  for(const [f,O] of builds){make({...O,host:H,fmt:f});const S=H._snaps[f];Object.assign(S,meta);S.tag=String(S.tag||'').replace(/ · (16:9|9:16)/,'').replace(/PATCH \d+/,'PATCH '+meta.num);}
  const use=f=>{for(const k of Object.keys(H))if(!keep.includes(k))delete H[k];Object.assign(H,H._snaps[f]);H.format=f;};
  H.setFormat=f=>{if(!H._snaps[f])return;use(f);try{localStorage.setItem('sp-format-'+meta.id,f);}catch(e){}};
  H.formats=builds.map(b=>b[0]);let f=H.formats[0];try{const s=localStorage.getItem('sp-format-'+meta.id);if(H._snaps[s])f=s;}catch(e){}
  use(f);return H;}
