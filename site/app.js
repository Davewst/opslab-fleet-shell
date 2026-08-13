// ---------- world ----------
function world(){return {
 'lab-b':{
  cwd:'/home/labuser',
  fs:{
   '/home/labuser':{d:['.bash_history']},
   '/opt/apps':{d:['reporting-api','shared']},
   '/opt/apps/reporting-api':{d:['docker-compose.yml','.env','records','logs']},
   '/opt/apps/reporting-api/records':{d:['2024-Q1-audit.pdf','2024-Q2-audit.pdf','2025-Q1-audit.pdf','2025-Q2-audit.pdf','... 4,118 more']},
   '/opt/apps/reporting-api/logs':{d:['app.log']},
   '/opt/apps/shared':{d:['docker-compose.yml']},
   '/var/backups':{d:[]},
   '/home/runner/actions-runner':{d:['.env','svc.sh','config.sh','externals','_work']},
   '/home/runner/actions-runner/externals':{d:['node20','node24']},
  },
  files:{
   '/opt/apps/reporting-api/docker-compose.yml':'services:\n  reporting-api-api:\n    image: ghcr.io/owner/reporting-api-api:1.9.4\n    restart: unless-stopped\n  reporting-api-ui:\n    image: ghcr.io/owner/reporting-api-ui:1.9.4\n    restart: unless-stopped',
   '/opt/apps/reporting-api/.env':'APP_ENV=prod\nDB_HOST=opslab-db-01\nDB_USER=aqc_ro',
   '/home/runner/actions-runner/.env':'ACTIONS_RUNNER_HOOK_JOB_STARTED=\n# FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 not set',
  },
  containers:[
   {n:'reporting-api-api',img:'ghcr.io/owner/reporting-api-api:1.9.4',up:true,rm:false},
   {n:'reporting-api-ui',img:'ghcr.io/owner/reporting-api-ui:1.9.4',up:true,rm:false},
   {n:'watchtower',img:'containrrr/watchtower:1.7.1',up:true,rm:false},
  ],
  services:{'reporting-api':{state:'active',enabled:true,exec:'/usr/bin/docker compose -f /opt/apps/reporting-api/docker-compose.yml up'}},
  runner:{svc:'active',registered:true},
  workflow:'enabled', dangling:3,
 },
 'lab-a':{
  cwd:'/home/labuser',
  fs:{
   '/home/labuser':{d:[]},
   '/opt/apps':{d:['catalog-ui','shared']},
   '/opt/apps/catalog-ui':{d:['README.md']},
   '/opt/apps/shared':{d:['docker-compose.yml']},
   '/var/backups':{d:['catalog-ui-20260731.tgz']},
   '/home/runner/actions-runner':{d:['.env','svc.sh','config.sh','externals','_work']},
   '/home/runner/actions-runner/externals':{d:['node20']},
  },
  files:{
   '/opt/apps/shared/docker-compose.yml':'services:\n  catalog-ui-ui:\n    image: ghcr.io/owner/catalog-ui-ui:3.2.0\n  opslab-portal:\n    image: ghcr.io/owner/opslab-portal:5.1.2',
  },
  containers:[
   {n:'opslab-portal',img:'ghcr.io/owner/opslab-portal:5.1.2',up:true,rm:false},
   {n:'watchtower',img:'containrrr/watchtower:1.7.1',up:true,rm:false},
  ],
  services:{}, runner:{svc:'active',registered:true}, workflow:'enabled', dangling:7,
 }
};}

let W=world(), host='lab-b', env='DEV', approved=false, root=false;
const TASKS=[
 {id:'disable',t:'Disable the workflow trigger so nothing redeploys mid-teardown'},
 {id:'map',t:'Map the unit to its real working directory before touching files'},
 {id:'backup',t:'Take a tarball of the deployment directory'},
 {id:'offhost',t:'Move the backup off the host it backs up'},
 {id:'stop',t:'Stop the containers (stop, not rm — leave a soak window)'},
 {id:'runner',t:'Deregister the self-hosted runner'},
 {id:'static',t:'Get written disposition for records/ before any deletion'},
];
let done={};

const term=document.getElementById('term');
function out(s,cls){const d=document.createElement('div');d.className='l '+(cls||'');d.textContent=s;term.appendChild(d);term.scrollTop=term.scrollHeight;}
function html(s){const d=document.createElement('div');d.className='l';d.innerHTML=s;term.appendChild(d);term.scrollTop=term.scrollHeight;}
function prompt(){
 const h=W[host];
 const p=h.cwd.replace('/home/labuser','~');
 document.getElementById('prompt').innerHTML=
  `<span class="p-user">${root?'root':'labuser'}</span>@<span class="p-host">${host}</span> <span class="p-path">${p}</span> ${root?'#':'$'}`;
}
function radius(n){[1,2,3].forEach(i=>document.getElementById('g'+i).classList.toggle('on',i===n));}

function refresh(){
 const h=W[host];
 document.getElementById('s-host').textContent=host;
 document.getElementById('s-user').textContent=root?'root (sudo)':'labuser';
 document.getElementById('s-ctr').textContent=h.containers.filter(c=>c.up&&!c.rm).length+' / '+h.containers.filter(c=>!c.rm).length;
 document.getElementById('s-run').textContent=h.runner.registered?(h.runner.svc):'deregistered';
 const bak=Object.keys(W).flatMap(k=>(W[k].fs['/var/backups']||{d:[]}).d.map(f=>k+':'+f));
 document.getElementById('s-bak').textContent=bak.length?bak.join(', '):'none';
 const ul=document.getElementById('tasks');ul.innerHTML='';
 TASKS.forEach(t=>{const li=document.createElement('li');li.textContent=t.t;if(done[t.id])li.className='done';ul.appendChild(li);});
 const g=document.getElementById('gate');
 g.classList.toggle('granted',approved);
 document.getElementById('gatetext').textContent=approved
  ?`your approver approved host-level changes on ${host} for ${env}. Approval is scoped to this host and drops if you change environment.`
  :`your approver has not approved a host-level change for ${env}. Destructive commands will be refused.`;
 document.getElementById('gatebtn').textContent=approved?'Revoke approval':'Request approval';
 prompt();
}

// ---------- gating ----------
function gate(what){
 if(!approved){
  html(`<div class="blocked"><span class="err">refused — no change ticket.</span>\nThis is an irreversible action (${what}) and your approver has not approved a host-level change on ${host} for ${env}.\nRequest approval in the panel, or pick a reversible step instead.</div>`);
  return false;
 }
 if(env==='PROD' && !done.stop){
  html(`<div class="blocked"><span class="err">refused — no soak window.</span>\nYou are in PROD and the containers were never stopped and left to soak. Stop first, verify nothing screams, then come back.</div>`);
  return false;
 }
 return true;
}

// ---------- filesystem helpers ----------
function resolve(p){
 const h=W[host];
 if(!p) return h.cwd;
 if(p.startsWith('~')) p=p.replace('~','/home/labuser');
 let base = p.startsWith('/') ? p : (h.cwd==='/'?'':h.cwd)+'/'+p;
 const parts=[];
 base.split('/').forEach(s=>{ if(!s||s==='.')return; if(s==='..')parts.pop(); else parts.push(s); });
 return '/'+parts.join('/');
}

// ---------- commands ----------
function run(raw){
 const line=raw.trim(); if(!line) return;
 let a=line.split(/\s+/);
 root=false;
 if(a[0]==='sudo'){ out("sudo: command not found — this fleet uses sudo",'err'); radius(1); return; }
 if(a[0]==='sudo'){ root=true; a=a.slice(1); if(!a.length){out('sudo: a command is required','err');return;} }
 const h=W[host], c=a[0];

 switch(c){
 case 'help': radius(1); html(
`<span class="note">navigation  </span> pwd · ls [path] · cd &lt;path&gt; · cat &lt;file&gt; · ssh &lt;lab-a|lab-b&gt; · whoami · clear · reset
<span class="note">containers  </span> docker ps [-a] · docker stop &lt;name&gt; · docker rm &lt;name&gt; · docker images · docker image prune [-a]
<span class="note">services    </span> systemctl status|stop|disable &lt;unit&gt; · systemctl show -p ExecStart &lt;unit&gt;
<span class="note">runner      </span> ./svc.sh status|stop|uninstall · ./config.sh remove --token XXX
<span class="note">workflow    </span> gh workflow disable deploy.yml · gh workflow list
<span class="note">files       </span> tar -czf &lt;out.tgz&gt; &lt;dir&gt; · scp &lt;file&gt; backup-vault: · rm -rf &lt;path&gt;
<span class="note">policy      </span> ticket — show what approval currently covers`); break;

 case 'clear': term.innerHTML=''; radius(1); break;
 case 'reset': W=world(); done={}; approved=false; term.innerHTML=''; banner(); refresh(); radius(1); return;
 case 'whoami': out(root?'root':'labuser'); radius(1); break;
 case 'hostname': out(host+'.lab.local'); radius(1); break;
 case 'pwd': out(h.cwd); radius(1); break;
 case 'ticket': radius(1); out(approved?`CHG open · ${env} · ${host} · requester labuser · approver your approver`:'no open change ticket'); break;

 case 'ssh': {
  radius(1);
  if(!W[a[1]]){out(`ssh: could not resolve host ${a[1]||''} — this sandbox has lab-a and lab-b`,'err');break;}
  host=a[1]; approved=false; out(`Last login: Sat Aug  8 06:12:03 2026 from 10.24.8.41`,'note');
  out(`approval does not follow you between hosts — it was dropped`,'warn'); break;
 }

 case 'ls': {
  radius(1);
  const p=resolve(a.find((x,i)=>i>0&&!x.startsWith('-')));
  if(h.files[p]){out(p);break;}
  if(!h.fs[p]){out(`ls: cannot access '${p}': No such file or directory`,'err');break;}
  out(h.fs[p].d.join('  ')||'(empty)'); break;
 }
 case 'cd': {
  radius(1);
  const p=resolve(a[1]||'/home/labuser');
  if(!h.fs[p]){out(`cd: ${p}: No such file or directory`,'err');break;}
  h.cwd=p; break;
 }
 case 'cat': {
  radius(1);
  const p=resolve(a[1]);
  if(h.files[p]) out(h.files[p]);
  else if(h.fs[p]) out(`cat: ${p}: Is a directory`,'err');
  else out(`cat: ${p}: No such file or directory`,'err');
  break;
 }

 case 'docker': return docker(a.slice(1));
 case 'systemctl': return systemctl(a.slice(1));
 case 'gh': return ghcmd(a.slice(1));

 case './svc.sh': {
  if(a[1]==='status'){radius(1);out(`actions.runner.owner-${host}.service - Active: ${h.runner.svc}`);break;}
  if(a[1]==='stop'){radius(2);h.runner.svc='inactive';out('Stopping actions.runner service...','good');break;}
  if(a[1]==='uninstall'){ if(!gate('runner service uninstall')){radius(3);break;} radius(3);h.runner.svc='removed';out('Removing systemd unit','good');break;}
  out('usage: ./svc.sh status|stop|uninstall','err'); break;
 }
 case './config.sh': {
  if(a[1]==='remove'){
   if(h.runner.svc==='active'){radius(1);out('config.sh: cannot remove while the service is running. ./svc.sh stop first.','err');break;}
   if(!a.includes('--token')){radius(1);out('config.sh: --token is required (generate a removal token in the repo settings)','err');break;}
   radius(3);
   if(!gate('runner deregistration')) break;
   h.runner.registered=false; done.runner=true;
   out('Runner removed successfully','good'); break;
  }
  out('usage: ./config.sh remove --token <TOKEN>','err'); break;
 }

 case 'tar': {
  radius(2);
  const gz=a.indexOf('-czf'); if(gz<0){out('tar: this sandbox only knows -czf','err');break;}
  const outf=a[gz+1], src=resolve(a[gz+2]);
  if(!h.fs[src]){out(`tar: ${a[gz+2]}: Cannot stat: No such file or directory`,'err');break;}
  const dest=resolve(outf), dir=dest.substring(0,dest.lastIndexOf('/'))||'/';
  if(!h.fs[dir]){out(`tar: ${dest}: Cannot open: No such file or directory`,'err');break;}
  h.fs[dir].d.push(dest.split('/').pop());
  out(`tar: created ${dest} (1.4 GiB)`,'good');
  done.backup=true;
  if(dir!=='/var/backups'||true) out(`note: this tarball is sitting on ${host}, the same host it backs up. Move it off before you delete anything.`,'warn');
  break;
 }
 case 'scp': {
  radius(2);
  if(!a[1]||!a[2]){out('usage: scp <file> backup-vault:','err');break;}
  out(`${a[1].split('/').pop()}                        100% 1.4GB  62.1MB/s   00:23`,'good');
  done.offhost=true; break;
 }

 case 'rm': {
  radius(3);
  const p=resolve(a[a.length-1]);
  if(!a.includes('-rf')&&!a.includes('-r')){out('rm: use -rf for directories in this sandbox','err');break;}
  if(p.includes('/records')){
   html(`<div class="blocked"><span class="err">refused — retained records.</span>\n<span class="mono">${p}</span> holds signed audit PDFs. Those are the record itself, not application state.\nNo command clears this. You need written disposition from your approver naming this directory, filed against the change ticket.</div>`);
   break;
  }
  if(!gate('recursive delete of '+p)) break;
  if(!done.backup){out('rm: refusing — no backup of this deployment exists yet','err');break;}
  if(!h.fs[p]){out(`rm: cannot remove '${p}': No such file or directory`,'err');break;}
  Object.keys(h.fs).forEach(k=>{if(k===p||k.startsWith(p+'/'))delete h.fs[k];});
  Object.keys(h.files).forEach(k=>{if(k.startsWith(p+'/'))delete h.files[k];});
  const parent=p.substring(0,p.lastIndexOf('/'))||'/';
  if(h.fs[parent])h.fs[parent].d=h.fs[parent].d.filter(x=>x!==p.split('/').pop());
  out(`removed ${p}`,'good'); break;
 }

 default: radius(1); out(`${c}: command not found — try help`,'err');
 }
 refresh();
}

function docker(a){
 const h=W[host];
 if(a[0]==='ps'){
  radius(1);
  const all=a.includes('-a');
  const rows=h.containers.filter(c=>!c.rm&&(all||c.up));
  out('CONTAINER ID   IMAGE                                      STATUS');
  rows.forEach(c=>out(`${Math.random().toString(16).slice(2,14)}   ${c.img.padEnd(42)} ${c.up?'Up 6 days':'Exited (0) 2 minutes ago'}`));
  if(!rows.length) out('(no containers)','note');
  if(!all && h.containers.some(c=>!c.up&&!c.rm)) out('note: stopped containers are hidden without -a. If `docker ps -a` also shows nothing, something removed them — check watchtower.','warn');
  return refresh();
 }
 if(a[0]==='images'){radius(1);out('REPOSITORY                                 TAG      SIZE');h.containers.filter(c=>!c.rm).forEach(c=>out(c.img.split(':')[0].padEnd(42)+' '+c.img.split(':')[1].padEnd(8)+' 412MB'));out(`<dangling>  ${h.dangling} untagged layers`,'note');return refresh();}
 if(a[0]==='stop'){
  radius(2);
  const c=h.containers.find(x=>x.n===a[1]&&!x.rm);
  if(!c){out(`Error response from daemon: No such container: ${a[1]}`,'err');return refresh();}
  c.up=false; out(a[1],'good');
  if(h.containers.filter(x=>!x.rm&&x.n.startsWith('reporting-api')).every(x=>!x.up)) done.stop=true;
  out('soak window starts now. Leave it stopped and watch for anything that breaks before you remove.','note');
  return refresh();
 }
 if(a[0]==='rm'){
  radius(3);
  if(!gate('container removal')) return refresh();
  const c=h.containers.find(x=>x.n===a[1]&&!x.rm);
  if(!c){out(`Error response from daemon: No such container: ${a[1]}`,'err');return refresh();}
  if(c.up){out(`Error: cannot remove a running container — stop it first`,'err');return refresh();}
  c.rm=true; out(a[1],'good'); return refresh();
 }
 if(a[0]==='image'&&a[1]==='prune'){
  radius(a.includes('-a')?3:2);
  if(a.includes('-a')){
   if(!gate('prune of all unreferenced images')) return refresh();
   out('WARNING: -a removes every image not used by a running container, including images for things you only stopped.','warn');
   out(`deleted: ${h.dangling+9} images, reclaimed 6.2GB`,'good'); h.dangling=0; return refresh();
  }
  out(`deleted: ${h.dangling} dangling layers, reclaimed 1.1GB`,'good'); h.dangling=0; return refresh();
 }
 if(a[0]==='compose'){radius(1);out('this sandbox drives compose through systemctl — try systemctl show -p ExecStart','note');return refresh();}
 radius(1); out(`docker: '${a[0]}' is not supported here`,'err'); refresh();
}

function systemctl(a){
 const h=W[host];
 const unit=(a[a.length-1]||'').replace('.service','');
 if(a[0]==='show'){
  radius(1);
  if(!h.services[unit]){out(`Unit ${unit}.service could not be found.`,'err');return refresh();}
  out('ExecStart={ path='+h.services[unit].exec+' }');
  done.map=true;
  out('this is the only trustworthy way to find the real working directory — the unit name is not the path.','note');
  return refresh();
 }
 if(!h.services[unit]){radius(1);out(`Unit ${unit}.service could not be found.`,'err');return refresh();}
 if(a[0]==='status'){radius(1);out(`● ${unit}.service\n   Loaded: loaded (${h.services[unit].enabled?'enabled':'disabled'})\n   Active: ${h.services[unit].state}`);return refresh();}
 if(a[0]==='stop'){radius(2);h.services[unit].state='inactive';out('',''); out(`stopped ${unit}.service`,'good');return refresh();}
 if(a[0]==='disable'){radius(2);h.services[unit].enabled=false;out(`Removed /etc/systemd/system/multi-user.target.wants/${unit}.service`,'good');return refresh();}
 radius(1); out(`systemctl: unsupported verb '${a[0]}'`,'err'); refresh();
}

function ghcmd(a){
 const h=W[host];
 if(a[0]==='workflow'&&a[1]==='list'){radius(1);out(`deploy.yml            ${h.workflow}\nbuild-and-scan.yml    enabled\ntrivy-scheduled.yml   enabled`);return refresh();}
 if(a[0]==='workflow'&&a[1]==='disable'){
  radius(2); h.workflow='disabled_manually'; done.disable=true;
  out(`✓ Disabled ${a[2]||'deploy.yml'}`,'good');
  out('good first move — kill the trigger before you touch anything on the host, or a push mid-teardown redeploys what you just stopped.','note');
  return refresh();
 }
 radius(1); out('gh: try `gh workflow list` or `gh workflow disable deploy.yml`','err'); refresh();
}

// ---------- boot ----------
function banner(){
 html(`<span class="disp" class="c-brass">Fleet Shell — rehearsal environment</span>
Two hosts, fake state, no consequences. The point is the order of operations, not the typing.

Standing objective: retire <span class="mono">reporting-api</span> from lab-b without losing anything you can't get back.
The panel on the right tracks what you've actually completed. Type <span class="mono">help</span> when you want the verb list.
`);
}
banner(); refresh(); radius(1);

const input=document.getElementById('cmd');
let hist=[],hi=0;
input.addEventListener('keydown',e=>{
 if(e.key==='Enter'){
  const v=input.value;
  html(`<span class="p-user">${'labuser'}</span>@<span class="p-host">${host}</span> <span class="p-path">${W[host].cwd.replace('/home/labuser','~')}</span> $ ${v.replace(/</g,'&lt;')}`);
  if(v.trim()){hist.push(v);hi=hist.length;}
  input.value=''; run(v);
 }
 if(e.key==='ArrowUp'){if(hi>0){hi--;input.value=hist[hi]||'';}e.preventDefault();}
 if(e.key==='ArrowDown'){if(hi<hist.length-1){hi++;input.value=hist[hi]||'';}else{hi=hist.length;input.value='';}e.preventDefault();}
});
document.getElementById('term').addEventListener('click',()=>input.focus());
document.getElementById('gatebtn').addEventListener('click',()=>{
 approved=!approved;
 out(approved?`— your approver: approved for ${env} on ${host}. Ping me before PROD. —`:`— approval revoked —`, approved?'good':'warn');
 refresh();
});
document.querySelectorAll('#envpick button').forEach(b=>b.addEventListener('click',()=>{
 document.querySelectorAll('#envpick button').forEach(x=>x.classList.remove('on'));
 b.classList.add('on'); env=b.dataset.env; approved=false;
 out(`environment set to ${env} — approval reset`,'warn'); refresh();
}));
