import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = { 
    apiKey: "AIzaSyCtOhGoiGPHYUgyERjg43pt6_QW-gBjhL4", 
    authDomain: "laboratorium-b4253.firebaseapp.com", 
    projectId: "laboratorium-b4253",
    storageBucket: "laboratorium-b4253.firebasestorage.app"
};

const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app);
let currentUserData = null;

// ==========================================
// 🛡️ SECURITY SHIELD
// ==========================================
(function(){
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.onkeydown = e => { if(e.keyCode == 123 || (e.ctrlKey && e.shiftKey && (e.keyCode == 73 || e.keyCode == 74)) || (e.ctrlKey && e.keyCode == 85)) return false; };
    setInterval(() => { debugger; }, 500); 
})();

const getVal = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ""; };

// ==========================================
// 🔑 AUTH & SESSION
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const uDoc = await getDoc(doc(db, "users", user.uid));
        if (uDoc.exists()) {
            currentUserData = { ...uDoc.data(), uid: user.uid };
            if(currentUserData.status === 'banned') { alert("DIBLOKIR!"); signOut(auth); return; }
            
            // Render UI & Name
            const names = document.querySelectorAll('#display-name');
            names.forEach(n => n.innerText = currentUserData.name);
            
            syncUI();
            loadProjects();
            loadNews();
            if (window.location.pathname.includes('profile.html')) loadProfileData(currentUserData);
            if (window.location.pathname.includes('user.html')) loadVisitorView();
        }
    } else {
        const prot = ['dashboard.html', 'project.html', 'media.html', 'profile.html', 'user.html'];
        if (prot.some(p => window.location.pathname.includes(p))) window.location.href = "login.html";
    }
});

function syncUI() {
    const ap = document.getElementById('admin-panel'), mp = document.getElementById('member-panel');
    if(document.getElementById('user-role-badge')) document.getElementById('user-role-badge').innerText = currentUserData.role.toUpperCase();
    if(document.getElementById('user-credits')) document.getElementById('user-credits').innerText = `$${currentUserData.credits || 0}`;
    
    if (currentUserData.role === 'owner') {
        if(ap) ap.style.display = 'block'; if(mp) mp.style.display = 'none';
    } else {
        if(ap) ap.style.display = 'none'; if(mp) mp.style.display = 'block';
    }
}

// ==========================================
// 🚀 DEPLOY SYSTEM
// ==========================================
const fOwn = document.getElementById('form-project-owner');
if(fOwn) fOwn.addEventListener('submit', async e => {
    e.preventDefault();
    await addDoc(collection(db, "projects"), {
        title: getVal('own-title'), description: getVal('own-desc'),
        type: getVal('own-type'), status: getVal('own-status'),
        downloadUrl: getVal('own-download'), authorId: currentUserData.uid,
        authorName: currentUserData.name, createdAt: serverTimestamp(), byRole: 'owner'
    });
    alert("Project Deployed!"); location.reload();
});

const fMem = document.getElementById('form-project-member');
if(fMem) fMem.addEventListener('submit', async e => {
    e.preventDefault();
    if(currentUserData.credits < 50) return alert("Kredit Kurang!");
    if(confirm("Bayar $50?")) {
        await updateDoc(doc(db, "users", currentUserData.uid), { credits: currentUserData.credits - 50 });
        await addDoc(collection(db, "projects"), {
            title: getVal('mem-title'), description: getVal('mem-desc'),
            downloadUrl: getVal('mem-download'), status: 'public', type: 'file',
            authorId: currentUserData.uid, authorName: currentUserData.name,
            createdAt: serverTimestamp(), byRole: 'member'
        });
        alert("Success!"); location.reload();
    }
});

// ==========================================
// ⚖️ MODERASI OWNER
// ==========================================
window.ownerAction = async (action) => {
    const tid = getVal('target-uid');
    if(!tid) return alert("Isi UID Target!");
    const ref = doc(db, "users", tid);
    if(action === 'ban') await updateDoc(ref, { status: 'banned' });
    if(action === 'warn') {
        const tDoc = await getDoc(ref);
        await updateDoc(ref, { warnings: (tDoc.data().warnings || 0) + 1 });
    }
    alert("Action Success!");
};

// ==========================================
// 👤 PROFILE & DECORATION
// ==========================================
const pForm = document.getElementById('profileForm');
if(pForm) pForm.addEventListener('submit', async e => {
    e.preventDefault();
    await updateDoc(doc(db, "users", auth.currentUser.uid), {
        name: getVal('edit-name'), bio: getVal('edit-bio'), skills: getVal('edit-skills'),
        portfolio: getVal('edit-portfolio'), photoUrl: getVal('edit-avatar-url'), bannerUrl: getVal('edit-banner-url')
    });
    alert("Profil Saved!"); location.reload();
});

window.buyDecoration = async (decoId) => {
    if (currentUserData.credits < 100) return alert("Kredit Kurang!");
    await updateDoc(doc(db, "users", auth.currentUser.uid), {
        credits: currentUserData.credits - 100, decoration: decoId
    });
    alert("Beli Berhasil!"); location.reload();
};

// ==========================================
// 📡 NEWS & REPOSITORY LOADER
// ==========================================
async function loadProjects() {
    const list = document.getElementById('project-list'); if(!list) return;
    const snap = await getDocs(query(collection(db, "projects"), orderBy("createdAt", "desc")));
    let h = '';
    snap.forEach(d => {
        const data = d.data();
        if (data.status === 'private' && currentUserData?.role !== 'owner') return;
        h += `<div class="glass card">
            <h3>${data.title} ${data.status==='private'?'🔒':''}</h3>
            <p style="font-size:0.8rem; color:#aaa;">${data.description}</p>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
                <a href="${data.downloadUrl}" target="_blank" class="btn btn-primary">Get Access</a>
                <small onclick="window.location.href='user.html?id=${data.authorId}'" style="cursor:pointer; color:#38bdf8;">By: ${data.authorName}</small>
            </div>
        </div>`;
    });
    list.innerHTML = h;
}

async function loadNews() {
    const list = document.getElementById('news-list') || document.getElementById('media-news-list');
    if(!list) return;
    const snap = await getDocs(query(collection(db, "news"), orderBy("createdAt", "desc")));
    let h = '';
    snap.forEach(d => {
        const data = d.data();
        const isI = data.type === 'important';
        h += `<div class="glass card" style="margin-bottom:10px; border-left:4px solid ${isI?'red':'#38bdf8'}">
                <small>${isI?'⚠️ PENTING':'INFO'}</small>
                <h4>${data.title}</h4><p>${data.content}</p>
              </div>`;
    });
    list.innerHTML = h;
}

document.getElementById('btnLogout')?.addEventListener('click', () => signOut(auth).then(() => window.location.href = "login.html"));
