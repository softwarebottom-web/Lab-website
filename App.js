import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 1. KONFIGURASI FIREBASE ---
const firebaseConfig = { 
    apiKey: "AIzaSyCtOhGoiGPHYUgyERjg43pt6_QW-gBjhL4", 
    authDomain: "laboratorium-b4253.firebaseapp.com", 
    projectId: "laboratorium-b4253",
    storageBucket: "laboratorium-b4253.firebasestorage.app"
};

const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app);
let currentUserData = null;

// --- 2. 🛡️ SUPER SECURITY (ANTI-F12, ANTI-SNOOP, ANTI-COPY) ---
(function(){
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.onkeydown = e => {
        if (e.keyCode == 123 || (e.ctrlKey && e.shiftKey && (e.keyCode == 73 || e.keyCode == 74)) || (e.ctrlKey && e.keyCode == 85)) return false;
    };
    // Debbuger Loop: Membuat browser "hang" jika nekat buka Inspect Element
    setInterval(() => { (function() { return false; }['constructor']('debugger')['call']()); }, 500);
    document.body.style.userSelect = "none";
})();

// Helper Ambil Nilai Input dengan Trim (Mencegah Spasi Kosong)
const getVal = (id) => { 
    const el = document.getElementById(id); 
    return el ? el.value.trim() : ""; 
};

// --- 3. 🔑 AUTH STATE & PANEL SYNC ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const uDoc = await getDoc(doc(db, "users", user.uid));
            if (uDoc.exists()) {
                currentUserData = { ...uDoc.data(), uid: user.uid };
                
                // Cek Status Banned
                if(currentUserData.status === 'banned') {
                    alert("AKSES DIBLOKIR: Anda telah dilarang masuk oleh Owner.");
                    signOut(auth).then(() => window.location.href = "login.html");
                    return;
                }

                // Sinkronisasi Nama di Semua Elemen (Display Name Fix)
                document.querySelectorAll('#display-name').forEach(el => {
                    el.innerText = currentUserData.name || "Member";
                });

                syncUI();
                loadProjects();
                loadNews();

                // Halaman Spesifik
                if (window.location.pathname.includes('profile.html')) loadProfileData(currentUserData);
                if (window.location.pathname.includes('user.html')) loadVisitorView();
            }
        } catch (e) { console.error("Sync Error:", e); }
    } else {
        // Proteksi Halaman Internal
        const prot = ['dashboard.html', 'project.html', 'media.html', 'profile.html', 'user.html'];
        if (prot.some(p => window.location.pathname.includes(p))) window.location.href = "login.html";
    }
});

function syncUI() {
    const ap = document.getElementById('admin-panel'), mp = document.getElementById('member-panel');
    const badge = document.getElementById('user-role-badge');
    const credits = document.getElementById('user-credits');

    if(badge) {
        badge.innerText = currentUserData.role.toUpperCase();
        badge.className = "badge role-" + currentUserData.role;
    }
    if(credits) credits.innerText = `$${currentUserData.credits || 0}`;

    // Visibility Panel Owner vs Member
    if (currentUserData.role === 'owner') {
        if(ap) ap.style.display = 'block';
        if(mp) mp.style.display = 'none';
    } else {
        if(ap) ap.style.display = 'none';
        if(mp) mp.style.display = 'block';
    }
}

// --- 4. 📁 REPOSITORY SYSTEM (LOAD & DEPLOY) ---
async function loadProjects() {
    const list = document.getElementById('project-list'); if(!list) return;
    try {
        const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        let h = '';
        
        snap.forEach(d => {
            const data = d.data();
            // Filter Project Private (Hanya Owner yang Bisa Lihat)
            if (data.status === 'private' && currentUserData?.role !== 'owner') return;

            h += `
            <div class="glass card project-item">
                <h3>${data.title} ${data.status === 'private' ? '🔒' : ''}</h3>
                <p style="font-size:0.85rem; color:#aaa; margin:10px 0;">${data.description}</p>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <a href="${data.downloadUrl}" target="_blank" class="btn btn-primary">Get Access</a>
                    <small onclick="window.location.href='user.html?id=${data.authorId}'" style="cursor:pointer; color:#38bdf8; font-weight:bold;">
                        By: ${data.authorName}
                    </small>
                </div>
                ${currentUserData?.role === 'owner' ? `<button onclick="window.delProj('${d.id}')" style="background:none; border:none; color:red; cursor:pointer; font-size:0.7rem; margin-top:10px;">Hapus Project</button>` : ''}
            </div>`;
        });
        list.innerHTML = h || '<p style="text-align:center;">Repository Kosong.</p>';
    } catch(e) { console.error(e); }
}

// Fungsi Post Project (Khusus Owner)
const fOwn = document.getElementById('form-project-owner');
if(fOwn) fOwn.addEventListener('submit', async e => {
    e.preventDefault();
    try {
        await addDoc(collection(db, "projects"), {
            title: getVal('own-title'),
            description: getVal('own-desc'),
            downloadUrl: getVal('own-download'),
            status: getVal('own-status'),
            authorId: currentUserData.uid,
            authorName: currentUserData.name,
            createdAt: serverTimestamp()
        });
        alert("Project Berhasil di Deploy!"); location.reload();
    } catch (err) { alert("Error: " + err.message); }
});

// --- 5. 📡 NEWS SYSTEM (MODAL & BROADCAST) ---
async function loadNews() {
    const list = document.getElementById('news-list') || document.getElementById('media-news-list');
    if(!list) return;
    try {
        const snap = await getDocs(query(collection(db, "news"), orderBy("createdAt", "desc")));
        let h = '';
        snap.forEach(d => {
            const data = d.data();
            const isImp = data.type === 'important';
            h += `
            <div class="glass card" style="margin-bottom:15px; border-left: 4px solid ${isImp ? '#ef4444' : '#38bdf8'}; cursor:${isImp ? 'pointer' : 'default'}"
                 ${isImp ? `onclick="window.openNewsModal('${data.title.replace(/'/g,"")}', '${data.content.replace(/'/g,"")}', '${data.link || ""}')"` : ''}>
                <span class="badge" style="background:${isImp ? '#ef4444' : '#38bdf8'}">${isImp ? '⚠️ PENTING' : 'INFO'}</span>
                <h4 style="margin:8px 0;">${data.title}</h4>
                <p style="font-size:0.85rem; color:#ccc;">${data.content.substring(0, 80)}...</p>
                ${isImp ? `<small style="color:#ef4444;">Klik untuk detail &rarr;</small>` : ''}
            </div>`;
        });
        list.innerHTML = h || '<p>Tidak ada berita.</p>';
    } catch(e) { console.error(e); }
}

window.openNewsModal = (t, c, l) => {
    const modal = document.getElementById('news-modal');
    if(!modal) return;
    document.getElementById('modal-title').innerText = t;
    document.getElementById('modal-desc').innerText = c;
    const btn = document.getElementById('modal-link');
    if(l && l !== "") { btn.href = l; btn.style.display = 'block'; } else { btn.style.display = 'none'; }
    modal.style.display = 'flex';
};

// --- 6. 👤 PROFILE & VISITOR SYSTEM ---
function loadProfileData(d) {
    // Sinkronkan Input Edit
    const map = { 'edit-name':'name', 'edit-bio':'bio', 'edit-skills':'skills', 'edit-portfolio':'portfolio', 'edit-avatar-url':'photoUrl', 'edit-banner-url':'bannerUrl', 'edit-phone':'phone' };
    for(let id in map) { if(document.getElementById(id)) document.getElementById(id).value = d[map[id]] || ""; }

    // Visual Display
    if(document.getElementById('display-avatar')) document.getElementById('display-avatar').src = d.photoUrl || "";
    if(document.getElementById('display-banner')) document.getElementById('display-banner').style.backgroundImage = `url('${d.bannerUrl}')`;
    
    // Dekorasi Permanen
    const frame = document.getElementById('avatar-frame');
    if(frame) frame.className = "avatar-wrapper deco-" + (d.decoration || 'none');
}

const pForm = document.getElementById('profileForm');
if(pForm) pForm.addEventListener('submit', async e => {
    e.preventDefault();
    try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
            name: getVal('edit-name'),
            phone: getVal('edit-phone'),
            bio: getVal('edit-bio'),
            skills: getVal('edit-skills'),
            portfolio: getVal('edit-portfolio'),
            photoUrl: getVal('edit-avatar-url'),
            bannerUrl: getVal('edit-banner-url')
        });
        alert("✅ Profil Berhasil Disimpan!"); location.reload();
    } catch (err) { alert(err.message); }
});

async function loadVisitorView() {
    const params = new URLSearchParams(window.location.search);
    const tid = params.get('id'); if(!tid) return;
    try {
        const uDoc = await getDoc(doc(db, "users", tid));
        if(uDoc.exists()) {
            const d = uDoc.data();
            if(document.getElementById('v-name')) document.getElementById('v-name').innerText = d.name;
            if(document.getElementById('v-bio')) document.getElementById('v-bio').innerText = d.bio || "Bio belum diisi.";
            if(document.getElementById('v-avatar')) document.getElementById('v-avatar').src = d.photoUrl || "";
            if(document.getElementById('v-banner')) document.getElementById('v-banner').style.backgroundImage = `url('${d.bannerUrl}')`;
            if(document.getElementById('v-frame')) document.getElementById('v-frame').className = "avatar-wrapper deco-" + (d.decoration || 'none');
        }
    } catch(e) { console.error(e); }
}

// --- 7. ⚖️ MODERASI & TOKO ---
window.buyDecoration = async (decoId) => {
    if (currentUserData.credits < 100) return alert("Kredit Kurang!");
    if (confirm("Gunakan $100 Kredit untuk Dekorasi ini?")) {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
            credits: currentUserData.credits - 100,
            decoration: decoId
        });
        alert("Dekorasi Berhasil Dibeli!"); location.reload();
    }
};

window.delProj = async (id) => { if(confirm("Hapus Project ini?")) { await deleteDoc(doc(db, "projects", id)); loadProjects(); } };

// --- 8. AUTH ACTIONS (LOGIN/REGISTER/LOGOUT) ---
const lForm = document.getElementById('loginForm');
if(lForm) lForm.addEventListener('submit', async e => {
    e.preventDefault();
    try {
        await setPersistence(auth, browserLocalPersistence);
        await signInWithEmailAndPassword(auth, getVal('email'), getVal('password'));
        window.location.href = "dashboard.html";
    } catch (err) { alert("Login Gagal: " + err.message); }
});

const rForm = document.getElementById('registerForm');
if(rForm) rForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = getVal('reg-email'), pass = getVal('reg-password'), name = getVal('reg-name'), phone = getVal('reg-phone');
    if(!pass || pass.length < 6) return alert("Password minimal 6 karakter!");
    try {
        const res = await createUserWithEmailAndPassword(auth, email, pass);
        await setDoc(doc(db, "users", res.user.uid), {
            name: name, phone: phone, role: 'member', credits: 50, status: 'active', decoration: 'none', createdAt: serverTimestamp()
        });
        window.location.href = "dashboard.html";
    } catch (err) { alert("Daftar Gagal: " + err.message); }
});

document.getElementById('btnLogout')?.addEventListener('click', () => signOut(auth).then(() => window.location.href = "login.html"));
