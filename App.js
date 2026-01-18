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
// 🛡️ 1. SECURITY SYSTEM (ANTI-THEFT)
// ==========================================
(function(){
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.onkeydown = e => {
        if (e.keyCode == 123 || (e.ctrlKey && e.shiftKey && (e.keyCode == 73 || e.keyCode == 74)) || (e.ctrlKey && e.keyCode == 85)) return false;
    };
    // Mencegah Inspect Element dengan Debugger Loop
    setInterval(() => { (function() { return false; }['constructor']('debugger')['call']()); }, 50);
    // Anti-Select Text
    document.body.style.userSelect = "none";
})();

const getVal = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ""; };

// ==========================================
// 🔑 2. AUTH & PANEL CONTROL
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const uDoc = await getDoc(doc(db, "users", user.uid));
            if (uDoc.exists()) {
                currentUserData = { ...uDoc.data(), uid: user.uid };
                
                // Cek Ban Status
                if(currentUserData.status === 'banned') {
                    alert("AKSES DIBLOKIR: Anda telah dilarang masuk."); signOut(auth); return;
                }

                syncUI();
                loadProjects();
                loadNews();
                if (window.location.pathname.includes('profile.html')) loadProfileData(currentUserData);
                if (window.location.pathname.includes('user.html')) loadVisitorView();
            }
        } catch (e) { console.error("Sync Error", e); }
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
// ➕ 3. LOGIN & REGISTER (ID SYNCED)
// ==========================================
const lForm = document.getElementById('loginForm');
if(lForm) lForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await setPersistence(auth, browserLocalPersistence);
        await signInWithEmailAndPassword(auth, getVal('email'), getVal('password'));
        window.location.href = "dashboard.html";
    } catch (err) { alert("Login Gagal: " + err.message); }
});

const rForm = document.getElementById('registerForm');
if(rForm) rForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = getVal('reg-email'), pass = getVal('reg-password'), name = getVal('reg-name'), phone = getVal('reg-phone');
    try {
        const res = await createUserWithEmailAndPassword(auth, email, pass);
        await setDoc(doc(db, "users", res.user.uid), {
            name: name, phone: phone, role: 'member', credits: 50, 
            status: 'active', bio: "New Member", decoration: 'none', createdAt: serverTimestamp()
        });
        window.location.href = "dashboard.html";
    } catch (err) { alert("Daftar Gagal: " + err.message); }
});

// ==========================================
// 👤 4. PROFILE, DECORATION & VISITOR
// ==========================================
function loadProfileData(d) {
    const ids = ['name', 'phone', 'bio', 'skills', 'portfolio', 'avatar-url', 'banner-url'];
    ids.forEach(id => { 
        const el = document.getElementById('edit-' + id);
        const dbKey = id === 'avatar-url' ? 'photoUrl' : (id === 'banner-url' ? 'bannerUrl' : id);
        if(el) el.value = d[dbKey] || "";
    });
    if(document.getElementById('display-avatar')) document.getElementById('display-avatar').src = d.photoUrl || "";
    if(document.getElementById('display-banner')) document.getElementById('display-banner').style.backgroundImage = `url('${d.bannerUrl}')`;
    const frame = document.getElementById('avatar-frame');
    if(frame && d.decoration) frame.className = "avatar-wrapper deco-" + d.decoration;
}

const pForm = document.getElementById('profileForm');
if(pForm) pForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
            name: getVal('edit-name'), phone: getVal('edit-phone'), bio: getVal('edit-bio'),
            skills: getVal('edit-skills'), portfolio: getVal('edit-portfolio'),
            photoUrl: getVal('edit-avatar-url'), bannerUrl: getVal('edit-banner-url')
        });
        alert("✅ Profil Berhasil Disimpan!"); location.reload();
    } catch (err) { alert(err.message); }
});

window.buyDecoration = async (decoId) => {
    if (currentUserData.credits < 100) return alert("Kredit Kurang!");
    await updateDoc(doc(db, "users", auth.currentUser.uid), {
        credits: currentUserData.credits - 100, decoration: decoId
    });
    alert("Dekorasi Aktif!"); location.reload();
};

async function loadVisitorView() {
    const params = new URLSearchParams(window.location.search);
    const tid = params.get('id'); if(!tid) return;
    const docS = await getDoc(doc(db, "users", tid));
    if(docS.exists()) {
        const d = docS.data();
        if(document.getElementById('v-name')) document.getElementById('v-name').innerText = d.name;
        if(document.getElementById('v-avatar')) document.getElementById('v-avatar').src = d.photoUrl;
        if(document.getElementById('v-banner')) document.getElementById('v-banner').style.backgroundImage = `url('${d.bannerUrl}')`;
    }
}

// ==========================================
// 🚀 5. REPOSITORY & NEWS
// ==========================================
async function loadProjects() {
    const list = document.getElementById('project-list'); if(!list) return;
    const snap = await getDocs(query(collection(db, "projects"), orderBy("createdAt", "desc")));
    let h = '';
    snap.forEach(d => {
        const data = d.data();
        if (data.status === 'locked' && currentUserData?.role !== 'owner') return;
        h += `<div class="glass card">
            <h3>${data.title} ${data.status==='locked'?'🔒':''}</h3>
            <p>${data.description}</p>
            <div style="margin-top:10px; display:flex; justify-content:space-between; align-items:center;">
                <a href="${data.downloadUrl}" target="_blank" class="btn btn-primary">Get Access</a>
                <small onclick="window.location.href='user.html?id=${data.authorId}'" style="cursor:pointer; color:cyan;">By: ${data.authorName}</small>
            </div>
            ${currentUserData.role==='owner' ? `<button onclick="window.delProj('${d.id}')" style="color:red; background:none; border:none; margin-top:10px; cursor:pointer;">Hapus Project</button>` : ''}
        </div>`;
    });
    list.innerHTML = h;
}

window.delProj = async (id) => { if(confirm("Hapus?")) { await deleteDoc(doc(db, "projects", id)); loadProjects(); } };

// NEWS BROADCAST
const fNews = document.getElementById('form-news');
if(fNews) fNews.addEventListener('submit', async e => {
    e.preventDefault();
    await addDoc(collection(db, "news"), {
        title: getVal('news-title'), content: getVal('news-content'),
        category: getVal('news-type'), createdAt: serverTimestamp()
    });
    alert("News Published!"); location.reload();
});

async function loadNews() {
    const list = document.getElementById('news-list'); if(!list) return;
    const snap = await getDocs(query(collection(db, "news"), orderBy("createdAt", "desc")));
    let h = '';
    snap.forEach(d => {
        const data = d.data();
        h += `<div class="glass card" style="margin-bottom:10px;">
            <small class="badge">${data.category}</small>
            <h4>${data.title}</h4><p>${data.content}</p>
        </div>`;
    });
    list.innerHTML = h;
}

// ==========================================
// ⚖️ 6. MODERASI (OWNER ONLY)
// ==========================================
window.ownerAction = async (uid, action) => {
    if(currentUserData.role !== 'owner') return;
    const ref = doc(db, "users", uid);
    if(action === 'ban') await updateDoc(ref, { status: 'banned' });
    if(action === 'warn') {
        const u = await getDoc(ref);
        await updateDoc(ref, { warnings: (u.data().warnings || 0) + 1 });
    }
    alert("Tindakan Berhasil.");
};

document.getElementById('btnLogout')?.addEventListener('click', () => signOut(auth).then(() => window.location.href = "login.html"));
