import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence, onAuthStateChanged, signOut, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- KONFIGURASI FIREBASE ---
const firebaseConfig = { 
    apiKey: "AIzaSyCtOhGoiGPHYUgyERjg43pt6_QW-gBjhL4", 
    authDomain: "laboratorium-b4253.firebaseapp.com", 
    projectId: "laboratorium-b4253", 
    storageBucket: "laboratorium-b4253.firebasestorage.app", 
    messagingSenderId: "752575889923", 
    appId: "1:752575889923:web:c0a2fefe62981209c7c436" 
};

const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app);
let currentUserData = null;

// Keamanan: Anti F12 & Klik Kanan
document.addEventListener('contextmenu', e => e.preventDefault());
document.onkeydown = e => { if(e.keyCode == 123 || (e.ctrlKey && e.shiftKey && (e.keyCode == 73 || e.keyCode == 74)) || (e.ctrlKey && e.keyCode == 85)) return false; };

const getSafeVal = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };

// ==========================================
// 🔄 AUTH STATE & PANEL CONTROL
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const uDoc = await getDoc(doc(db, "users", user.uid));
            if (uDoc.exists()) {
                currentUserData = { ...uDoc.data(), uid: user.uid };

                // Cek Status BAN
                if(currentUserData.status === 'banned') {
                    alert("Akses Ditolak: Akun Anda telah di-BAN oleh Owner.");
                    signOut(auth).then(() => window.location.href = "login.html");
                    return;
                }

                // UI Sync (Badge & Kredit)
                if(document.getElementById('user-role-badge')) document.getElementById('user-role-badge').innerText = currentUserData.role.toUpperCase();
                if(document.getElementById('user-credits')) document.getElementById('user-credits').innerText = `$${currentUserData.credits || 0}`;

                // Panel Visibility (Fix: Munculkan Panel yang Hilang)
                const ap = document.getElementById('admin-panel'), mp = document.getElementById('member-panel');
                if (currentUserData.role === 'owner') {
                    if(ap) ap.style.display = 'block';
                    if(mp) mp.style.display = 'none';
                } else {
                    if(ap) ap.style.display = 'none';
                    if(mp) mp.style.display = 'block';
                }

                loadProjects();
                loadNews();
                if (window.location.pathname.includes('profile')) loadProfileData(currentUserData);
            }
        } catch (e) { console.error("Sync Error:", e); }
    } else {
        const prot = ['dashboard.html', 'project.html', 'media.html', 'profile.html'];
        if (prot.some(p => window.location.pathname.includes(p))) window.location.href = "login.html";
    }
});

// ==========================================
// 🚀 REPOSITORY SYSTEM (Owner can view Private)
// ==========================================
async function loadProjects() {
    const list = document.getElementById('project-list'); if(!list) return;
    const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q); 
    let h = '';
    
    snap.forEach(d => {
        const data = d.data();
        const isOwner = currentUserData?.role === 'owner';
        
        // Filter: Project Private Hanya untuk Owner
        if (data.status === 'locked' && !isOwner) return;

        h += `
        <div class="glass card project-item" style="margin-bottom:15px; border-left: 4px solid ${data.byRole === 'owner' ? '#38bdf8' : '#10b981'};">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3>${data.title} ${data.status === 'locked' ? '🔒' : '🌍'}</h3>
                ${isOwner ? `<button onclick="window.deleteProject('${d.id}')" class="btn-delete">Hapus</button>` : ''}
            </div>
            <p style="color:#aaa; font-size:0.9rem; margin:10px 0;">${data.description}</p>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <small style="color:#38bdf8; cursor:pointer;" onclick="alert('UID Author: ${data.authorId}')">Author: ${data.authorName || 'System'}</small>
                <a href="${data.downloadUrl}" target="_blank" class="btn btn-primary" style="padding:4px 12px; font-size:0.8rem;">Download</a>
            </div>
        </div>`;
    });
    list.innerHTML = h || '<p>Belum ada repository.</p>';
}

// Deploy Owner (Unlimited & Free)
const fOwn = document.getElementById('form-project-owner');
if(fOwn) fOwn.addEventListener('submit', async e => {
    e.preventDefault();
    await addDoc(collection(db, "projects"), {
        title: getSafeVal('own-title'),
        description: getSafeVal('own-desc'),
        type: getSafeVal('own-type'),
        status: getSafeVal('own-status'),
        demoUrl: getSafeVal('own-demo'),
        downloadUrl: getSafeVal('own-download'),
        byRole: 'owner',
        authorId: currentUserData.uid,
        authorName: currentUserData.name,
        createdAt: serverTimestamp()
    });
    alert("Project Deployed!"); location.reload();
});

// Deploy Member (Cost $50)
const fMem = document.getElementById('form-project-member');
if(fMem) fMem.addEventListener('submit', async e => {
    e.preventDefault();
    if(currentUserData.credits < 50) return alert("Kredit Kurang!");
    if(confirm("Bayar $50 untuk deploy?")) {
        await updateDoc(doc(db, "users", currentUserData.uid), { credits: currentUserData.credits - 50 });
        await addDoc(collection(db, "projects"), {
            title: getSafeVal('mem-title'),
            description: getSafeVal('mem-desc'),
            type: getSafeVal('mem-type'),
            status: 'unlocked',
            downloadUrl: getSafeVal('mem-download'),
            byRole: 'member',
            authorId: currentUserData.uid,
            authorName: currentUserData.name,
            createdAt: serverTimestamp()
        });
        alert("Deploy Berhasil!"); location.reload();
    }
});

// ==========================================
// 👤 PROFILE & DECORATION (Permanent Save)
// ==========================================
function loadProfileData(d) {
    if(document.getElementById('edit-name')) document.getElementById('edit-name').value = d.name || "";
    // ... load field lainnya
    
    // Pasang Dekorasi Secara Permanen
    const container = document.getElementById('profile-card-container');
    if(container && d.decoration) container.className = "glass card deco-" + d.decoration;
}

window.buyDecoration = async (decoId) => {
    const price = 100;
    if (currentUserData.credits < price) return alert("Kredit Kurang!");
    if (confirm(`Beli dekorasi seharga $${price}?`)) {
        await updateDoc(doc(db, "users", currentUserData.uid), {
            credits: currentUserData.credits - price,
            decoration: decoId // Tersimpan permanen di DB
        });
        alert("Dekorasi Berhasil Disimpan!");
        location.reload();
    }
};

// ==========================================
// ⚖️ MODERASI (Ban & Warning)
// ==========================================
window.handleModeration = async (uid, action) => {
    const userRef = doc(db, "users", uid);
    if(action === 'ban') {
        await updateDoc(userRef, { status: 'banned' });
        alert("Member telah di-BAN permanen.");
    } else {
        const u = await getDoc(userRef);
        const nw = (u.data().warnings || 0) + 1;
        await updateDoc(userRef, { warnings: nw });
        alert(`Warning terkirim. Total: ${nw}`);
    }
};

// ==========================================
// 📡 BROADCAST & MODAL
// ==========================================
async function loadNews() {
    const list = document.getElementById('news-list'); if(!list) return;
    const q = query(collection(db, "news"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q); let h = '';
    snap.forEach(d => {
        const data = d.data(); const isI = data.type === 'important';
        h += `<div class="glass card" style="margin-bottom:10px; cursor:pointer;" ${isI ? `onclick="window.openNewsModal('${data.title}','${data.content}','${data.link}')"` : ''}>
            <small class="${isI ? 'badge-important' : 'badge-general'}">${isI ? '⚠️ PENTING' : 'INFO'}</small>
            <h4 style="margin:5px 0;">${data.title}</h4></div>`;
    });
    list.innerHTML = h;
}

window.openNewsModal = (t, d, l) => {
    document.getElementById('modal-title').innerText = t;
    document.getElementById('modal-desc').innerText = d;
    const btn = document.getElementById('modal-link');
    btn.href = l || "#"; btn.style.display = l ? 'block' : 'none';
    document.getElementById('news-modal').style.display = 'flex';
};

window.deleteProject = async (id) => { if(confirm("Hapus?")) { await deleteDoc(doc(db, "projects", id)); loadProjects(); } };
document.getElementById('btnLogout')?.addEventListener('click', () => signOut(auth).then(()=>window.location.href="index.html"));
