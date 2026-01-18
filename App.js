import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCtOhGoiGPHYUgyERjg43pt6_QW-gBjhL4",
  authDomain: "laboratorium-b4253.firebaseapp.com",
  projectId: "laboratorium-b4253",
  storageBucket: "laboratorium-b4253.firebasestorage.app",
  messagingSenderId: "752575889923",
  appId: "1:752575889923:web:c0a2fefe62981209c7c436",
  measurementId: "G-L6T24T2QJR"
};

const _0x5a21=function(a,b){const c=_0x42f0();return _0x5a21=function(d,e){d=d-0x12c;let f=c[d];return f},_0x5a21(a,b)};(function(a,b){const c=_0x5a21,d=a();while(!![]){try{const e=-parseInt(c(0x13c))/0x1+parseInt(c(0x134))/0x2*(-parseInt(c(0x139))/0x3)+parseInt(c(0x132))/0x4+parseInt(c(0x130))/0x5*(-parseInt(c(0x135))/0x6)+parseInt(c(0x13a))/0x7+parseInt(c(0x13b))/0x8+parseInt(c(0x133))/0x9;if(e===b)break;else d['push'](d['shift']());}catch(f){d['push'](d['shift']());}}}(_0x42f0,0x3a7e5));const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);let currentUserData=null;document['addEventListener']('contextmenu',a=>a['preventDefault']()),document['onkeydown']=function(a){const b=_0x5a21;if(a['keyCode']==0x7b||a[b(0x12e)]&&a['shiftKey']&&(a[b(0x137)]==0x49||a['keyCode']==0x4a)||a['ctrlKey']&&a['keyCode']==0x55)return![];};const getSafeVal=a=>{const b=document['getElementById'](a);return b?b['value']:'';};function _0x42f0(){const a=['keyCode','872584BfRRLC','47416HhRAsX','1590793mOatLp','455964yPZNoI','ctrlKey','1675840zicrAn','105NStCNo','6884605fWJkAm','1128384WkYnRE','1464672pMskrB','1464789vXnSRR','1123456pOnStA'];_0x42f0=function(){return a};return _0x42f0()}

// --- LOGIKA UTAMA (ANTI-LOOP) ---
onAuthStateChanged(auth, async (user) => {
    const list = document.getElementById('project-list');
    const mediaList = document.getElementById('media-news-list');
    if (user) {
        const uDoc = await getDoc(doc(db, "users", user.uid));
        if (uDoc.exists()) {
            currentUserData = { ...uDoc.data(), uid: user.uid };
            if(document.getElementById('user-role-badge')) document.getElementById('user-role-badge').innerText = currentUserData.role.toUpperCase();
            if(document.getElementById('user-credits')) document.getElementById('user-credits').innerText = `$${currentUserData.credits || 0}`;
            
            // Panel Control
            const aP = document.getElementById('admin-panel');
            const mP = document.getElementById('member-panel');
            if(currentUserData.role === 'owner'){
                if(aP) aP.style.display = 'block';
                if(mP) mP.style.display = 'none';
            } else {
                if(aP) aP.style.display = 'none';
                if(mP) mP.style.display = 'block';
            }
            loadProjects(); loadNews();
            if (window.location.pathname.includes('profile')) loadProfileData(currentUserData);
        }
    } else {
        if (['dashboard.html', 'project.html', 'media.html', 'profile.html'].some(p => window.location.pathname.includes(p))) window.location.href = "login.html";
    }
});

// --- LOAD DATA FUNCTIONS ---
async function loadProjects() {
    const list = document.getElementById('project-list'); if(!list) return;
    const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q); let h = '';
    snap.forEach(d => {
        const data = d.data(); const isOwner = currentUserData?.role === 'owner';
        if (data.status === 'locked' && !isOwner) return;
        h += `<div class="glass card" style="margin-bottom:20px;border-left:4px solid ${data.byRole==='owner'?'#38bdf8':'#10b981'}">
            <div style="display:flex;justify-content:space-between"><h3>${data.title} ${data.status==='locked'?'🔒':''}</h3></div>
            <p>${data.description}</p><div style="margin-top:10px">
            ${isOwner?`<button onclick="window.deleteProject('${d.id}')" class="btn-delete">Hapus</button>`:''}
            <a href="${data.downloadUrl}" target="_blank" class="btn btn-primary">Download</a></div></div>`;
    });
    list.innerHTML = h || '<p>Repository Kosong</p>';
}

async function loadNews() {
    const list = document.getElementById('news-list') || document.getElementById('media-news-list'); if(!list) return;
    const q = query(collection(db, "news"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q); let h = '';
    snap.forEach(d => {
        const data = d.data(); const isImp = data.type === 'important';
        h += `<div class="glass card" style="margin-bottom:15px;cursor:pointer" ${isImp?`onclick="window.openNewsModal('${data.title}','${data.content}','${data.link||'#'}')"`:''}>
            <span class="news-badge ${isImp?'badge-important':'badge-general'}">${isImp?'PENTING':'INFO'}</span>
            <h4>${data.title}</h4>${!isImp?`<p>${data.content}</p>`:''}</div>`;
    });
    list.innerHTML = h;
}

// --- FUNGSI GLOBAL ---
window.deleteProject = async (id) => { if(confirm("Hapus?")) { await deleteDoc(doc(db, "projects", id)); loadProjects(); } };
window.openNewsModal = (t, d, l) => { 
    document.getElementById('modal-title').innerText = t; document.getElementById('modal-desc').innerText = d;
    const b = document.getElementById('modal-link'); b.href = l; b.style.display = (l && l!=='#') ? 'block' : 'none';
    document.getElementById('news-modal').style.display = 'flex';
};

// --- AUTH HANDLERS ---
const lF = document.getElementById('loginForm');
if(lF) lF.addEventListener('submit', e => {
    e.preventDefault(); signInWithEmailAndPassword(auth, getSafeVal('email'), getSafeVal('password')).then(()=>window.location.href="dashboard.html").catch(a=>alert(a.message));
});

document.getElementById('btnLogout')?.addEventListener('click', () => signOut(auth).then(()=>window.location.href="index.html"));
