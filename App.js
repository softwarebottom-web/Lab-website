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

// --- 🛡️ SECURITY: ANTI-MALING & ANTI-F12 ---
(function(){
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.onkeydown = e => { if(e.keyCode == 123 || (e.ctrlKey && e.shiftKey && (e.keyCode == 73 || e.keyCode == 74)) || (e.ctrlKey && e.keyCode == 85)) return false; };
    setInterval(() => { debugger; }, 1000); 
})();

const getVal = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };

// --- 🔑 AUTH: PERSISTENCE & STATE CHECK ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const uDoc = await getDoc(doc(db, "users", user.uid));
            if (uDoc.exists()) {
                currentUserData = { ...uDoc.data(), uid: user.uid };
                
                // Cek status banned
                if(currentUserData.status === 'banned') {
                    alert("Akses Ditolak!"); signOut(auth); return;
                }

                syncUI();
                loadProjects();
                loadNews();
                if (window.location.pathname.includes('profile.html')) loadProfileData(currentUserData);
                if (window.location.pathname.includes('user.html')) loadVisitorView();
            } else {
                // Jika data Firestore belum ada, jangan redirect ke login dulu
                console.log("Menunggu pembuatan data profile...");
            }
        } catch (e) { console.error("Auth Error:", e); }
    } else {
        const protectedPages = ['dashboard.html', 'project.html', 'media.html', 'profile.html', 'user.html'];
        if (protectedPages.some(p => window.location.pathname.includes(p))) window.location.href = "login.html";
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

// --- ➕ REGISTER & LOGIN SYSTEM (FIXED) ---
const rForm = document.getElementById('registerForm');
if(rForm) rForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = getVal('reg-email'), pass = getVal('reg-pass'), name = getVal('reg-name');
    try {
        const res = await createUserWithEmailAndPassword(auth, email, pass);
        // LANGSUNG BUAT DATA FIRESTORE AGAR GAK LOADING
        await setDoc(doc(db, "users", res.user.uid), {
            name: name, role: 'member', credits: 50, status: 'active', decoration: 'none',
            bio: "New Member", skills: "", photoUrl: "", bannerUrl: "", createdAt: serverTimestamp()
        });
        alert("Pendaftaran Berhasil!"); window.location.href = "dashboard.html";
    } catch (err) { alert(err.message); }
});

const lForm = document.getElementById('loginForm');
if(lForm) lForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await setPersistence(auth, browserLocalPersistence);
        await signInWithEmailAndPassword(auth, getVal('login-email'), getVal('login-pass'));
        window.location.href = "dashboard.html";
    } catch (err) { alert("Login Gagal: " + err.message); }
});

// --- 📁 DATA SYSTEM: NEWS & PROJECTS ---
async function loadNews() {
    const list = document.getElementById('news-list'); if(!list) return;
    const snap = await getDocs(query(collection(db, "news"), orderBy("createdAt", "desc")));
    let h = '';
    snap.forEach(d => {
        const data = d.data();
        h += `<div class="glass card" style="margin-bottom:10px;">
                <span class="badge">${data.category || 'INFO'}</span>
                <h4>${data.title}</h4><p>${data.content}</p>
              </div>`;
    });
    list.innerHTML = h || "<p>Tidak ada berita.</p>";
}

async function loadProjects() {
    const list = document.getElementById('project-list'); if(!list) return;
    const snap = await getDocs(query(collection(db, "projects"), orderBy("createdAt", "desc")));
    let h = '';
    snap.forEach(d => {
        const data = d.data();
        if (data.status === 'private' && currentUserData?.role !== 'owner') return;
        h += `<div class="glass card">
            <h3>${data.title} ${data.status==='private'?'🔒':''}</h3>
            <p>${data.description}</p>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
                <a href="${data.downloadUrl}" target="_blank" class="btn btn-primary">Get Access</a>
                <small onclick="window.location.href='user.html?id=${data.authorId}'" style="cursor:pointer; color:cyan;">By: ${data.authorName}</small>
            </div>
        </div>`;
    });
    list.innerHTML = h;
}

// --- 👤 PROFILE & DECORATION ---
window.buyDecoration = async (decoId) => {
    if (currentUserData.credits < 100) return alert("Kredit Kurang!");
    await updateDoc(doc(db, "users", auth.currentUser.uid), {
        credits: currentUserData.credits - 100, decoration: decoId
    });
    alert("Dekorasi Disimpan!"); location.reload();
};

function loadProfileData(d) {
    const ids = ['name', 'phone', 'bio', 'skills', 'portfolio', 'avatar-url', 'banner-url'];
    ids.forEach(id => { 
        const el = document.getElementById('edit-' + id);
        if(el) el.value = d[id] || (id==='avatar-url'?d.photoUrl:d.bannerUrl) || "";
    });
    if(document.getElementById('display-banner')) document.getElementById('display-banner').style.backgroundImage = `url('${d.bannerUrl}')`;
    const frame = document.getElementById('avatar-frame');
    if(frame && d.decoration) frame.className = "avatar-wrapper deco-" + d.decoration;
}

const pForm = document.getElementById('profileForm');
if(pForm) pForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await updateDoc(doc(db, "users", auth.currentUser.uid), {
        name: getVal('edit-name'), bio: getVal('edit-bio'), skills: getVal('edit-skills'),
        portfolio: getVal('edit-portfolio'), photoUrl: getVal('edit-avatar-url'), bannerUrl: getVal('edit-banner-url')
    });
    alert("Profil Berhasil Diperbarui!"); location.reload();
});

document.getElementById('btnLogout')?.addEventListener('click', () => signOut(auth).then(() => window.location.href = "index.html"));
