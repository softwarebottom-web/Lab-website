import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, collection, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 1. KONFIGURASI FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyCtOhGoiGPHYUgyERjg43pt6_QW-gBjhL4",
  authDomain: "laboratorium-b4253.firebaseapp.com",
  projectId: "laboratorium-b4253",
  storageBucket: "laboratorium-b4253.firebasestorage.app",
  messagingSenderId: "752575889923",
  appId: "1:752575889923:web:c0a2fefe62981209c7c436",
  measurementId: "G-L6T24T2QJR"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUserData = null;

// ==========================================
// 🛡️ SECURITY SHIELD (Anti-Maling & Anti-F12)
// ==========================================
document.addEventListener('contextmenu', e => e.preventDefault());
document.onkeydown = function(e) {
    if(e.keyCode == 123 || (e.ctrlKey && e.shiftKey && (e.keyCode == 73 || e.keyCode == 74)) || (e.ctrlKey && e.keyCode == 85)) {
        return false;
    }
};

// ==========================================
// 🔑 LOGIN LOGIC
// ==========================================
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const btn = loginForm.querySelector('button');
        btn.innerText = "Memproses..."; btn.disabled = true;

        signInWithEmailAndPassword(auth, email, password)
            .then(() => { window.location.href = "dashboard.html"; })
            .catch((error) => {
                btn.innerText = "Login"; btn.disabled = false;
                alert("Login Gagal: " + error.message);
            });
    });
}

// ==========================================
// 📝 REGISTER LOGIC (Bonus $300)
// ==========================================
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = registerForm.querySelector('button');
        btn.innerText = "Mendaftarkan..."; btn.disabled = true;

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, 
                document.getElementById('reg-email').value, 
                document.getElementById('reg-password').value
            );
            await setDoc(doc(db, "users", userCredential.user.uid), {
                name: document.getElementById('reg-name').value,
                phone: document.getElementById('reg-phone').value,
                email: document.getElementById('reg-email').value,
                role: "member",
                credits: 300,
                bio: "New Member",
                joinDate: serverTimestamp()
            });
            alert("✅ Registrasi Berhasil! Saldo $300 telah ditambahkan.");
            window.location.href = "dashboard.html";
        } catch (error) {
            alert("Gagal: " + error.message);
            btn.innerText = "Daftar"; btn.disabled = false;
        }
    });
}

// ==========================================
// 🔄 AUTH STATE & DATA SYNC
// ==========================================
onAuthStateChanged(auth, async (user) => {
    const isDashboard = document.getElementById('project-list'); 
    const isMedia = document.getElementById('media-news-list');
    const isProfile = window.location.pathname.includes('profile');
    
    if (user) {
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                currentUserData = userDoc.data();
                currentUserData.uid = user.uid;

                // Update UI Element yang ada di layar
                if(document.getElementById('user-role-badge')) document.getElementById('user-role-badge').innerText = currentUserData.role.toUpperCase();
                if(document.getElementById('user-credits')) document.getElementById('user-credits').innerText = `$${currentUserData.credits || 0}`;

                // Tampilkan Panel sesuai Role
                const adminPanel = document.getElementById('admin-panel');
                const memberPanel = document.getElementById('member-panel');
                if (currentUserData.role === 'owner') {
                    if(adminPanel) adminPanel.style.display = 'block';
                } else {
                    if(memberPanel) memberPanel.style.display = 'block';
                }

                if (isDashboard || isMedia) {
                    loadProjects();
                    loadNews();
                }
                if (isProfile) loadProfileData(currentUserData);
            }
        } catch (e) { console.error("Error Fetch User:", e); }
    } else {
        const protectedPages = ['dashboard.html', 'project.html', 'media.html', 'profile.html'];
        if (protectedPages.some(p => window.location.pathname.includes(p))) window.location.href = "login.html";
    }
});

// ==========================================
// 🚀 REPOSITORY SYSTEM (Projects)
// ==========================================
async function loadProjects() {
    const list = document.getElementById('project-list');
    if(!list) return;

    try {
        const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        let html = '';
        
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const pid = docSnap.id;
            const isOwner = currentUserData && currentUserData.role === 'owner';
            const deleteBtn = isOwner ? `<button onclick="window.deleteProject('${pid}')" class="btn-delete" style="float:right;">Hapus 🗑️</button>` : '';

            html += `
                <div class="glass card" style="margin-bottom: 20px; border-left: 4px solid ${data.byRole === 'owner' ? '#38bdf8' : '#10b981'};">
                    <div style="display:flex; justify-content:space-between;">
                        <h3>${data.title}</h3>
                        <span class="badge">${data.byRole === 'owner' ? 'OFFICIAL' : 'MEMBER'}</span>
                    </div>
                    <p style="font-size:0.9rem; color:#ccc; margin:5px 0;">${data.description}</p>
                    <div style="margin-top:10px;">
                        ${deleteBtn}
                        <a href="${data.downloadUrl}" target="_blank" class="btn btn-primary">Download</a>
                    </div>
                </div>`;
        });
        list.innerHTML = html || '<p>Repository Kosong.</p>';
    } catch (e) { console.error(e); }
}

// Deploy Logic
const formOwner = document.getElementById('form-project-owner');
if(formOwner) {
    formOwner.addEventListener('submit', async (e) => {
        e.preventDefault();
        await addDoc(collection(db, "projects"), {
            title: document.getElementById('own-title').value,
            description: document.getElementById('own-desc').value,
            downloadUrl: document.getElementById('own-download').value,
            byRole: 'owner',
            createdAt: serverTimestamp()
        });
        alert("Official Project Berhasil!"); location.reload();
    });
}

const formMember = document.getElementById('form-project-member');
if(formMember) {
    formMember.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (currentUserData.credits < 50) return alert("Saldo tidak cukup ($50 diperlukan)");
        if (!confirm("Konfirmasi pembayaran $50 untuk deploy?")) return;

        try {
            const newCredits = currentUserData.credits - 50;
            await updateDoc(doc(db, "users", currentUserData.uid), { credits: newCredits });
            await addDoc(collection(db, "projects"), {
                title: document.getElementById('mem-title').value,
                description: document.getElementById('mem-desc').value,
                downloadUrl: document.getElementById('mem-download').value,
                byRole: 'member',
                createdAt: serverTimestamp()
            });
            alert("Project Member Berhasil!"); location.reload();
        } catch (e) { alert(e.message); }
    });
}

window.deleteProject = async (id) => {
    if(confirm("Hapus project ini secara permanen?")) {
        await deleteDoc(doc(db, "projects", id));
        loadProjects();
    }
};

// ==========================================
// 📡 NEWS & BROADCAST SYSTEM
// ==========================================
async function loadNews() {
    const list = document.getElementById('news-list') || document.getElementById('media-news-list');
    if(!list) return;

    const q = query(collection(db, "news"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    let html = '';

    snap.forEach(doc => {
        const d = doc.data();
        const isImp = d.type === 'important';
        const click = isImp ? `onclick="window.openNewsModal('${d.title.replace(/'/g, "")}', '${d.content.replace(/'/g, "")}', '${d.link || "#"}')"` : '';

        html += `
            <div class="glass card ${isImp ? 'news-item-important' : ''}" ${click} style="margin-bottom:15px; cursor:pointer; padding:15px;">
                <div style="display:flex; align-items:center;">
                    <span class="news-badge ${isImp ? 'badge-important' : 'badge-general'}">${isImp ? '⚠️ PENTING' : 'INFO'}</span>
                    <h4 style="margin:0; font-size:1rem;">${d.title}</h4>
                </div>
                ${!isImp ? `<p style="margin-top:8px; font-size:0.85rem; color:#aaa;">${d.content}</p>` : '<small style="color:red; display:block; margin-top:5px;">Klik untuk detail</small>'}
            </div>`;
    });
    list.innerHTML = html || '<p>Belum ada berita.</p>';
}

const formNews = document.getElementById('form-news');
if(formNews) {
    formNews.addEventListener('submit', async (e) => {
        e.preventDefault();
        await addDoc(collection(db, "news"), {
            title: document.getElementById('news-title').value,
            content: document.getElementById('news-content').value,
            type: document.getElementById('news-type').value,
            link: document.getElementById('news-link').value,
            createdAt: serverTimestamp()
        });
        alert("Broadcast Terkirim!"); formNews.reset(); loadNews();
    });
}

window.openNewsModal = (t, d, l) => {
    if(!document.getElementById('news-modal')) return;
    document.getElementById('modal-title').innerText = t;
    document.getElementById('modal-desc').innerText = d;
    const btn = document.getElementById('modal-link');
    if(l && l !== '#') { btn.href = l; btn.style.display = 'block'; } else { btn.style.display = 'none'; }
    document.getElementById('news-modal').style.display = 'flex';
};

// ==========================================
// 👤 PROFILE SYSTEM
// ==========================================
function loadProfileData(data) {
    const ids = ['edit-name', 'edit-phone', 'edit-bio', 'edit-avatar-url', 'edit-banner-url', 'edit-skills'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            const key = id.split('-')[1] === 'avatar' ? 'photoUrl' : (id.split('-')[1] === 'banner' ? 'bannerUrl' : id.split('-')[1]);
            el.value = data[key] || "";
        }
    });

    if(document.getElementById('display-name')) document.getElementById('display-name').innerText = data.name || "User";
    if(document.getElementById('display-avatar') && data.photoUrl) document.getElementById('display-avatar').src = data.photoUrl;
}

const profileForm = document.getElementById('profileForm');
if(profileForm) {
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        try {
            await updateDoc(doc(db, "users", user.uid), {
                name: document.getElementById('edit-name').value,
                phone: document.getElementById('edit-phone').value,
                bio: document.getElementById('edit-bio').value,
                photoUrl: document.getElementById('edit-avatar-url').value,
                bannerUrl: document.getElementById('edit-banner-url').value,
                skills: document.getElementById('edit-skills').value
            });
            alert("✅ Profil Diperbarui!"); location.reload();
        } catch (e) { alert("Gagal: " + e.message); }
    });
}

// 🚪 LOGOUT
document.getElementById('btnLogout')?.addEventListener('click', () => {
    signOut(auth).then(() => { window.location.href="index.html"; });
});
