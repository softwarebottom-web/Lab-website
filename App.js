import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, query, orderBy, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = { 
    apiKey: "AIzaSyCtOhGoiGPHYUgyERjg43pt6_QW-gBjhL4", 
    authDomain: "laboratorium-b4253.firebaseapp.com", 
    projectId: "laboratorium-b4253",
    storageBucket: "laboratorium-b4253.firebasestorage.app"
};

const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app);
let currentUserData = null;

// Helper ambil nilai input (Pencegah Error Loading)
const getVal = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ""; };

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const uDoc = await getDoc(doc(db, "users", user.uid));
        if (uDoc.exists()) {
            currentUserData = { ...uDoc.data(), uid: user.uid };
            
            // ISI NAMA & DATA GLOBAL (Solusi Masalah 6)
            document.querySelectorAll('#display-name').forEach(el => el.innerText = currentUserData.name);
            
            // LOAD SEMUA (Solusi Masalah 2 & 3)
            syncUI();
            loadProjects();
            loadNews();

            if (window.location.pathname.includes('profile.html')) loadProfileData();
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
// 🚀 REPOSITORY FIX (Solusi Masalah 1 & 2)
// ==========================================
const fOwn = document.getElementById('form-project-owner');
if(fOwn) fOwn.addEventListener('submit', async e => {
    e.preventDefault();
    try {
        await addDoc(collection(db, "projects"), {
            title: getVal('own-title'), description: getVal('own-desc'),
            downloadUrl: getVal('own-download'), status: getVal('own-status'),
            authorId: currentUserData.uid, authorName: currentUserData.name,
            createdAt: serverTimestamp()
        });
        alert("Berhasil Post!"); location.reload();
    } catch(err) { alert("Gagal: " + err.message); }
});

async function loadProjects() {
    const list = document.getElementById('project-list'); if(!list) return;
    const snap = await getDocs(query(collection(db, "projects"), orderBy("createdAt", "desc")));
    let h = '';
    snap.forEach(d => {
        const data = d.data();
        h += `<div class="glass card">
            <h3>${data.title}</h3>
            <p>${data.description}</p>
            <a href="${data.downloadUrl}" target="_blank" class="btn btn-primary">Download</a>
            <small style="display:block;margin-top:10px;color:var(--accent);">By: ${data.authorName}</small>
        </div>`;
    });
    list.innerHTML = h || "<p>Belum ada project.</p>";
}

// ==========================================
// 👤 PROFILE FIX (Solusi Masalah 4, 5, 6)
// ==========================================
function loadProfileData() {
    // Sinkronkan ID Input dengan Database
    const mapping = {
        'edit-name': 'name', 'edit-phone': 'phone', 'edit-bio': 'bio',
        'edit-skills': 'skills', 'edit-portfolio': 'portfolio',
        'edit-avatar-url': 'photoUrl', 'edit-banner-url': 'bannerUrl'
    };
    for(let id in mapping) {
        if(document.getElementById(id)) document.getElementById(id).value = currentUserData[mapping[id]] || "";
    }

    // Tampilkan Foto & Banner (Masalah 4)
    if(document.getElementById('display-avatar')) document.getElementById('display-avatar').src = currentUserData.photoUrl || '';
    if(document.getElementById('display-banner')) document.getElementById('display-banner').style.backgroundImage = `url('${currentUserData.bannerUrl || ''}')`;
    
    // Tampilkan Dekorasi (Masalah 5)
    const frame = document.getElementById('avatar-frame');
    if(frame) frame.className = "avatar-wrapper deco-" + (currentUserData.decoration || 'none');
}

const pForm = document.getElementById('profileForm');
if(pForm) pForm.addEventListener('submit', async e => {
    e.preventDefault();
    try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
            name: getVal('edit-name'), phone: getVal('edit-phone'),
            bio: getVal('edit-bio'), skills: getVal('edit-skills'),
            portfolio: getVal('edit-portfolio'), photoUrl: getVal('edit-avatar-url'),
            bannerUrl: getVal('edit-banner-url')
        });
        alert("Profil Berhasil Diupdate!"); location.reload();
    } catch(err) { alert(err.message); }
});
