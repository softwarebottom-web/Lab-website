import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// --- 2. SECURITY SHIELD (MENCEGAH PENCURIAN KODE) ---
(function() {
    // Anti Klik Kanan
    document.addEventListener('contextmenu', e => e.preventDefault());
    // Anti F12, Ctrl+Shift+I, Ctrl+U
    document.onkeydown = function(e) {
        if (e.keyCode == 123 || 
            (e.ctrlKey && e.shiftKey && (e.keyCode == 73 || e.keyCode == 74)) || 
            (e.ctrlKey && e.keyCode == 85)) {
            return false;
        }
    };
    // Mendeteksi jika Console dibuka
    setInterval(() => {
        const before = new Date().getTime();
        debugger;
        const after = new Date().getTime();
        if (after - before > 100) {
            document.body.innerHTML = "<h1>Security Protection Active</h1>";
        }
    }, 1000);
})();

const getVal = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };

// --- 3. LOGIKA PANEL & AUTH ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const uDoc = await getDoc(doc(db, "users", user.uid));
            if (uDoc.exists()) {
                currentUserData = { ...uDoc.data(), uid: user.uid };
                
                if(currentUserData.status === 'banned') {
                    alert("AKSES DIBLOKIR: Anda telah di-ban.");
                    signOut(auth).then(() => window.location.href = "login.html");
                    return;
                }

                // Munculkan Panel sesuai Role
                updateUI();
                loadProjects();
                loadNews();
                if (window.location.pathname.includes('profile')) loadProfileData(currentUserData);
            } else {
                // Jika user login tapi data di Firestore tidak ada (Fix loading register)
                console.error("User data not found in Firestore.");
            }
        } catch (e) { console.error("Error Auth Sync:", e); }
    } else {
        if (!window.location.pathname.includes('login.html')) window.location.href = "login.html";
    }
});

function updateUI() {
    const ap = document.getElementById('admin-panel');
    const mp = document.getElementById('member-panel');
    const roleBadge = document.getElementById('user-role-badge');
    const creditDisplay = document.getElementById('user-credits');

    if(roleBadge) roleBadge.innerText = currentUserData.role.toUpperCase();
    if(creditDisplay) creditDisplay.innerText = `$${currentUserData.credits || 0}`;

    if (currentUserData.role === 'owner') {
        if(ap) ap.style.display = 'block'; if(mp) mp.style.display = 'none';
    } else {
        if(ap) ap.style.display = 'none'; if(mp) mp.style.display = 'block';
    }
}

// --- 4. REPOSITORY SYSTEM (POST & LOAD) ---
async function loadProjects() {
    const list = document.getElementById('project-list'); if(!list) return;
    const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q); 
    let h = '';
    
    snap.forEach(d => {
        const data = d.data();
        if (data.status === 'private' && currentUserData?.role !== 'owner') return;

        h += `
        <div class="glass card project-item" style="margin-bottom:15px; border-left: 4px solid ${data.byRole === 'owner' ? '#38bdf8' : '#10b981'};">
            <h3>${data.title} ${data.status === 'private' ? '🔒' : ''}</h3>
            <p style="font-size:0.9rem; color:#aaa; margin:10px 0;">${data.description}</p>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <small style="color:#38bdf8; cursor:pointer;" onclick="viewAuthor('${data.authorId}')">Author: ${data.authorName}</small>
                <div>
                    <a href="${data.downloadUrl}" target="_blank" class="btn btn-primary" style="padding:5px 15px;">Download</a>
                    ${currentUserData?.role === 'owner' ? `<button onclick="deleteProject('${d.id}')" style="background:red; color:white; border:none; padding:5px; border-radius:5px; margin-left:10px; cursor:pointer;">Hapus</button>` : ''}
                </div>
            </div>
        </div>`;
    });
    list.innerHTML = h || '<p>Tidak ada repository.</p>';
}

// Post Owner
const fOwn = document.getElementById('form-project-owner');
if(fOwn) fOwn.addEventListener('submit', async e => {
    e.preventDefault();
    try {
        await addDoc(collection(db, "projects"), {
            title: getVal('own-title'), description: getVal('own-desc'),
            type: getVal('own-type'), status: getVal('own-status'),
            downloadUrl: getVal('own-download'), byRole: 'owner',
            authorId: currentUserData.uid, authorName: currentUserData.name,
            createdAt: serverTimestamp()
        });
        alert("Deployed!"); location.reload();
    } catch (e) { alert(e.message); }
});

// --- 5. DEKORASI PERMANEN & PROFILE ---
window.buyDecoration = async (decoId) => {
    if (currentUserData.credits < 100) return alert("Kredit tidak cukup!");
    if (confirm("Gunakan $100 untuk dekorasi ini?")) {
        try {
            await updateDoc(doc(db, "users", auth.currentUser.uid), {
                credits: currentUserData.credits - 100,
                decoration: decoId
            });
            alert("Berhasil Dibeli!"); location.reload();
        } catch (e) { alert("Gagal Simpan: " + e.message); }
    }
};

function loadProfileData(d) {
    if(document.getElementById('edit-name')) document.getElementById('edit-name').value = d.name || "";
    if(document.getElementById('display-name')) document.getElementById('display-name').innerText = d.name || "User";
    if(document.getElementById('display-banner')) document.getElementById('display-banner').style.backgroundImage = `url('${d.bannerUrl}')`;
    const frame = document.getElementById('avatar-frame');
    if(frame && d.decoration) frame.className = "avatar-wrapper deco-" + d.decoration;
}

// --- 6. MODERASI & ACTIONS ---
window.deleteProject = async (id) => {
    if(confirm("Hapus project ini?")) {
        await deleteDoc(doc(db, "projects", id));
        loadProjects();
    }
};

window.viewAuthor = async (uid) => {
    const u = await getDoc(doc(db, "users", uid));
    if(u.exists()) {
        const d = u.data();
        alert(`INFO AUTHOR\nNama: ${d.name}\nBio: ${d.bio || '-'}\nSkill: ${d.skills || '-'}`);
    }
};

document.getElementById('btnLogout')?.addEventListener('click', () => signOut(auth).then(()=>window.location.href="index.html"));
