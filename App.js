import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyCtOhGoiGPHYUgyERjg43pt6_QW-gBjhL4", authDomain: "laboratorium-b4253.firebaseapp.com", projectId: "laboratorium-b4253", storageBucket: "laboratorium-b4253.firebasestorage.app", messagingSenderId: "752575889923", appId: "1:752575889923:web:c0a2fefe62981209c7c436", measurementId: "G-L6T24T2QJR" };
const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app);
let currentUserData = null;

/* SECURITY BLOCK */
document.addEventListener('contextmenu', e => e.preventDefault());
document.onkeydown = function(e) { if(e.keyCode == 123 || (e.ctrlKey && e.shiftKey && (e.keyCode == 73 || e.keyCode == 74)) || (e.ctrlKey && e.keyCode == 85)) return false; };

const getSafeVal = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };

/* AUTH SYSTEM */
onAuthStateChanged(auth, async (user) => {
    const isD = document.getElementById('project-list'), isM = document.getElementById('media-news-list');
    if (user) {
        const uDoc = await getDoc(doc(db, "users", user.uid));
        if (uDoc.exists()) {
            currentUserData = { ...uDoc.data(), uid: user.uid };
            if(document.getElementById('user-role-badge')) document.getElementById('user-role-badge').innerText = currentUserData.role.toUpperCase();
            if(document.getElementById('user-credits')) document.getElementById('user-credits').innerText = `$${currentUserData.credits || 0}`;
            const aP = document.getElementById('admin-panel'), mP = document.getElementById('member-panel');
            if(currentUserData.role === 'owner'){ if(aP) aP.style.display='block'; if(mP) mP.style.display='none'; } 
            else { if(aP) aP.style.display='none'; if(mP) mP.style.display='block'; }
            loadProjects(); loadNews();
            if (window.location.pathname.includes('profile')) loadProfileData(currentUserData);
        }
    } else {
        if (['dashboard.html', 'project.html', 'media.html', 'profile.html'].some(p => window.location.pathname.includes(p))) window.location.href = "login.html";
    }
});

/* DATA LOADERS */
async function loadProjects() {
    const list = document.getElementById('project-list'); if(!list) return;
    const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q); let h = '';
    snap.forEach(d => {
        const data = d.data(); const isOwner = currentUserData?.role === 'owner';
        if (data.status === 'locked' && !isOwner) return;
        h += `<div class="glass card" style="margin-bottom:20px;border-left:4px solid ${data.byRole==='owner'?'#38bdf8':'#10b981'}"><h3>${data.title} ${data.status==='locked'?'🔒':''}</h3><p>${data.description}</p><div style="margin-top:10px">${isOwner?`<button onclick="window.deleteProject('${d.id}')" class="btn-delete">Hapus</button>`:''}<a href="${data.downloadUrl}" target="_blank" class="btn btn-primary">Download</a></div></div>`;
    });
    list.innerHTML = h || '<p>Repository Kosong</p>';
}

async function loadNews() {
    const list = document.getElementById('news-list') || document.getElementById('media-news-list'); if(!list) return;
    const q = query(collection(db, "news"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q); let h = '';
    snap.forEach(d => {
        const data = d.data(); const isI = data.type === 'important';
        h += `<div class="glass card" style="margin-bottom:15px;cursor:pointer" ${isI?`onclick="window.openNewsModal('${data.title.replace(/'/g,"")}','${data.content.replace(/'/g,"")}','${data.link||"#"}')"`:''}><span class="news-badge ${isI?'badge-important':'badge-general'}">${isI?'PENTING':'INFO'}</span><h4>${data.title}</h4>${!isI?`<p>${data.content}</p>`:''}</div>`;
    });
    list.innerHTML = h;
}

/* ACTIONS */
window.deleteProject = async (id) => { if(confirm("Hapus?")) { await deleteDoc(doc(db, "projects", id)); loadProjects(); } };
window.openNewsModal = (t, d, l) => { document.getElementById('modal-title').innerText = t; document.getElementById('modal-desc').innerText = d; const b = document.getElementById('modal-link'); b.href = l; b.style.display = (l && l!=='#') ? 'block' : 'none'; document.getElementById('news-modal').style.display = 'flex'; };

const lF = document.getElementById('loginForm'); if(lF) lF.addEventListener('submit', e => { e.preventDefault(); signInWithEmailAndPassword(auth, getSafeVal('email'), getSafeVal('password')).then(()=>window.location.href="dashboard.html").catch(a=>alert(a.message)); });
const rF = document.getElementById('registerForm'); if(rF) rF.addEventListener('submit', async e => { e.preventDefault(); try { const uC = await createUserWithEmailAndPassword(auth, getSafeVal('reg-email'), getSafeVal('reg-password')); await setDoc(doc(db, "users", uC.user.uid), { name: getSafeVal('reg-name'), phone: getSafeVal('reg-phone'), email: getSafeVal('reg-email'), role: "member", credits: 300, bio: "New Member", joinDate: serverTimestamp() }); alert("Registrasi Berhasil!"); window.location.href = "dashboard.html"; } catch (e) { alert(e.message); } });
const pF = document.getElementById('profileForm'); if(pF) pF.addEventListener('submit', async e => { e.preventDefault(); try { await updateDoc(doc(db, "users", auth.currentUser.uid), { name: getSafeVal('edit-name'), phone: getSafeVal('edit-phone'), bio: getSafeVal('edit-bio'), photoUrl: getSafeVal('edit-avatar-url'), bannerUrl: getSafeVal('edit-banner-url'), skills: getSafeVal('edit-skills') }); alert("Profil Updated!"); location.reload(); } catch (e) { alert(e.message); } });
document.getElementById('btnLogout')?.addEventListener('click', () => signOut(auth).then(()=>window.location.href="index.html"));
function loadProfileData(d){ const f=['name','phone','bio','avatar-url','banner-url','skills']; f.forEach(x=>{ const el=document.getElementById('edit-'+x); if(el) el.value=d[x==='avatar-url'?'photoUrl':(x==='banner-url'?'bannerUrl':x)]||""; }); if(document.getElementById('display-name')) document.getElementById('display-name').innerText=d.name||"User"; if(document.getElementById('display-avatar')) document.getElementById('display-avatar').src=d.photoUrl||""; }
