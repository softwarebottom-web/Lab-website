import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence, onAuthStateChanged, signOut, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 1. KONFIGURASI FIREBASE ---
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

// --- 2. SECURITY SHIELD (Anti-Maling) ---
document.addEventListener('contextmenu', e => e.preventDefault());
document.onkeydown = e => { 
    if(e.keyCode == 123 || (e.ctrlKey && e.shiftKey && (e.keyCode == 73 || e.keyCode == 74)) || (e.ctrlKey && e.keyCode == 85)) return false; 
};

// Helper: Ambil value aman agar tidak error null
const getVal = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };

// --- 3. AUTH & SESSION PERSISTENCE ---
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

                // Sync UI & Panel Visibility
                syncUI();
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

function syncUI() {
    if(document.getElementById('user-role-badge')) document.getElementById('user-role-badge').innerText = currentUserData.role.toUpperCase();
    if(document.getElementById('user-credits')) document.getElementById('user-credits').innerText = `$${currentUserData.credits || 0}`;

    const ap = document.getElementById('admin-panel'), mp = document.getElementById('member-panel');
    if (currentUserData.role === 'owner') {
        if(ap) ap.style.display = 'block'; if(mp) mp.style.display = 'none';
    } else {
        if(ap) ap.style.display = 'none'; if(mp) mp.style.display = 'block';
    }
}

// --- 4. REPOSITORY & MODERASI ---
async function loadProjects() {
    const list = document.getElementById('project-list'); if(!list) return;
    const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q); 
    let h = '';
    
    snap.forEach(d => {
        const data = d.data();
        const isOwner = currentUserData?.role === 'owner';
        if (data.status === 'private' && !isOwner) return;

        h += `<div class="glass card project-item" style="margin-bottom:15px; border-left:4px solid ${data.byRole === 'owner' ? '#38bdf8' : '#10b981'};">
            <div onclick="window.viewProjectDetail('${d.id}')" style="cursor:pointer">
                <h3>${data.title} ${data.status === 'private' ? '🔒' : '🌍'}</h3>
                <p style="font-size:0.85rem; color:#ccc;">${data.description.substring(0, 50)}...</p>
            </div>
            <div style="margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.1); display:flex; justify-content:space-between; align-items:center;">
                <small onclick="window.viewPublicProfile('${data.authorId}')" style="color:#38bdf8; cursor:pointer;">By: ${data.authorName || 'Member'}</small>
                ${isOwner ? `<button onclick="window.deleteProject('${d.id}')" class="btn-delete">Hapus</button>` : ''}
            </div>
        </div>`;
    });
    list.innerHTML = h || '<p>Repository Kosong.</p>';
}

window.viewProjectDetail = async (id) => {
    const d = await getDoc(doc(db, "projects", id));
    if(!d.exists()) return;
    const data = d.data();
    const modal = document.getElementById('project-modal');
    if(modal) {
        document.getElementById('m-title').innerText = data.title;
        document.getElementById('m-desc').innerText = data.description;
        const b = document.getElementById('m-download'); b.href = data.downloadUrl;
        b.innerText = data.type === 'deploy' ? "Download Zip 📂" : "View Source 🔗";
        modal.style.display = 'flex';
    }
};

window.viewPublicProfile = async (uid) => {
    const uDoc = await getDoc(doc(db, "users", uid));
    if(uDoc.exists()) {
        const d = uDoc.data();
        alert(`--- PROFIL AUTHOR ---\nNama: ${d.name}\nBio: ${d.bio}\nSkill: ${d.skills}\nPortfolio: ${d.portfolio || '-'}`);
    }
};

// --- 5. DEKORASI & PROFILE (FIXED SAVE) ---
window.buyDecoration = async (decoId) => {
    if (currentUserData.credits < 100) return alert("Kredit Kurang!");
    if (confirm("Gunakan $100 Kredit untuk Dekorasi Permanen?")) {
        await updateDoc(doc(db, "users", currentUserData.uid), {
            credits: currentUserData.credits - 100,
            decoration: decoId
        });
        alert("Dekorasi Berhasil Disimpan!"); location.reload();
    }
};

function loadProfileData(d) {
    const f = ['name', 'phone', 'bio', 'skills', 'portfolio'];
    f.forEach(x => { if(document.getElementById('edit-'+x)) document.getElementById('edit-'+x).value = d[x] || ""; });
    
    if(document.getElementById('display-name')) document.getElementById('display-name').innerText = d.name || "User";
    if(document.getElementById('display-avatar')) document.getElementById('display-avatar').src = d.photoUrl || "";
    if(document.getElementById('display-banner')) document.getElementById('display-banner').style.backgroundImage = `url('${d.bannerUrl}')`;
    
    const frame = document.getElementById('avatar-frame');
    if(frame && d.decoration) frame.className = "avatar-wrapper deco-" + d.decoration;
}

const pF = document.getElementById('profileForm');
if(pF) pF.addEventListener('submit', async e => {
    e.preventDefault();
    try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
            name: getVal('edit-name'), phone: getVal('edit-phone'), bio: getVal('edit-bio'),
            skills: getVal('edit-skills'), portfolio: getVal('edit-portfolio'),
            photoUrl: getVal('edit-avatar-url'), bannerUrl: getVal('edit-banner-url')
        });
        alert("✅ Profil Diperbarui!"); location.reload();
    } catch (e) { alert(e.message); }
});

// --- 6. ACTIONS ---
window.deleteProject = async (id) => { if(confirm("Hapus?")) { await deleteDoc(doc(db, "projects", id)); loadProjects(); } };
document.getElementById('btnLogout')?.addEventListener('click', () => signOut(auth).then(()=>window.location.href="index.html"));
