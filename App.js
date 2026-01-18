import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut 
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

let currentUserData = null; // Simpan data user global

console.log("🚀 System Restarted. Login Logic Fixed.");

// ==========================================
// 2. LOGIKA LOGIN (PRIORITAS UTAMA)
// ==========================================
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    console.log("🔒 Login Form Detected");
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const btn = loginForm.querySelector('button');

        btn.innerText = "Memproses...";
        btn.disabled = true;

        signInWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                console.log("✅ Login Berhasil:", userCredential.user.email);
                alert("Login Sukses!");
                window.location.href = "dashboard.html";
            })
            .catch((error) => {
                console.error("❌ Login Gagal:", error);
                btn.innerText = "Login";
                btn.disabled = false;
                
                let msg = "Gagal: " + error.message;
                if(error.code === 'auth/wrong-password') msg = "Password Salah!";
                if(error.code === 'auth/user-not-found') msg = "Akun tidak ditemukan. Daftar dulu!";
                alert(msg);
            });
    });
}

// ==========================================
// 3. LOGIKA REGISTRASI (DAPAT $300)
// ==========================================
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = registerForm.querySelector('button');
        btn.innerText = "Mendaftarkan..."; btn.disabled = true;

        try {
            // 1. Buat Akun Auth
            const userCredential = await createUserWithEmailAndPassword(auth, 
                document.getElementById('reg-email').value, 
                document.getElementById('reg-password').value
            );
            
            // 2. Simpan ke Database + Kredit $300
            await setDoc(doc(db, "users", userCredential.user.uid), {
                name: document.getElementById('reg-name').value,
                phone: document.getElementById('reg-phone').value,
                email: document.getElementById('reg-email').value,
                role: "member", // Default
                credits: 300,   // Bonus Awal
                bio: "New Member",
                joinDate: serverTimestamp()
            });

            alert("✅ Registrasi Berhasil! Anda mendapat saldo awal $300.");
            window.location.href = "dashboard.html";
        } catch (error) {
            alert("Gagal Daftar: " + error.message);
            btn.innerText = "Daftar Sekarang"; btn.disabled = false;
        }
    });
}

// ==========================================
// 4. CEK USER & DASHBOARD LOGIC
// ==========================================
onAuthStateChanged(auth, async (user) => {
    // Cek halaman saat ini
    const isDashboard = document.getElementById('project-list'); 
    
    if (user) {
        console.log("👤 User Active:", user.email);

        // Ambil Data Lengkap User (Role & Kredit)
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                currentUserData = userDoc.data();
                currentUserData.uid = user.uid;

                // --- UPDATE UI DASHBOARD ---
                if (isDashboard) {
                    // Update Badge Role
                    const badge = document.getElementById('user-role-badge');
                    if(badge) badge.innerText = currentUserData.role.toUpperCase();

                    // Update Saldo Kredit
                    const creditDisplay = document.getElementById('user-credits');
                    if(creditDisplay) creditDisplay.innerText = `$${currentUserData.credits || 0}`;

                    // Tampilkan Panel (Owner vs Member)
                    const adminPanel = document.getElementById('admin-panel');
                    const memberPanel = document.getElementById('member-panel');

                    if (currentUserData.role === 'owner') {
                        if(adminPanel) adminPanel.style.display = 'block';
                    } else {
                        if(memberPanel) memberPanel.style.display = 'block';
                    }

                    // Load Data Project & News
                    loadProjects();
                    loadNews();
                }
                
                // --- UPDATE UI PROFILE ---
                if (window.location.pathname.includes('profile')) loadProfileData(currentUserData);
            }
        } catch (e) {
            console.error("Error Get User Data:", e);
        }

    } else {
        // Jika tidak login, tendang dari halaman dashboard
        const protectedPages = ['dashboard.html', 'project.html', 'media.html', 'profile.html'];
        const currentPage = window.location.pathname.split("/").pop();
        if (protectedPages.some(p => currentPage.includes(p))) {
            window.location.href = "login.html";
        }
    }
});

// ==========================================
// 5. FITUR PROJECT (DEPLOY & DELETE)
// ==========================================

// A. LOAD PROJECTS
async function loadProjects() {
    const list = document.getElementById('project-list');
    if(!list) return;

    list.innerHTML = '<p style="text-align:center;">🔄 Memuat Repository...</p>';

    try {
        const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            list.innerHTML = '<p style="text-align:center;">Belum ada project.</p>';
            return;
        }

        let html = '';
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const pid = docSnap.id;
            const isOwner = currentUserData && currentUserData.role === 'owner';
            
            // Tombol Delete (Hanya Owner)
            const deleteBtn = isOwner 
                ? `<button onclick="window.deleteProject('${pid}')" class="btn-delete" style="float:right; margin-left:10px;">Hapus 🗑️</button>` 
                : '';

            html += `
                <div class="glass card" style="margin-bottom: 20px; border-left: 4px solid ${data.byRole === 'owner' ? '#38bdf8' : '#10b981'};">
                    <div style="display:flex; justify-content:space-between;">
                        <h3 style="font-size:1.1rem;">${data.title}</h3>
                        <span style="font-size:0.7rem; background:rgba(255,255,255,0.1); padding:2px 8px; border-radius:10px;">
                            ${data.byRole === 'owner' ? 'OFFICIAL' : 'MEMBER'}
                        </span>
                    </div>
                    <p style="font-size:0.9rem; color:#ccc; margin:5px 0;">${data.description}</p>
                    <div style="margin-top:10px;">
                        ${deleteBtn}
                        <a href="${data.downloadUrl}" target="_blank" class="btn btn-primary" style="padding:4px 10px; font-size:0.8rem;">Download</a>
                    </div>
                </div>`;
        });
        list.innerHTML = html;
    } catch (e) { list.innerHTML = "Gagal memuat: " + e.message; }
}

// B. DEPLOY OWNER (GRATIS)
const formOwner = document.getElementById('form-project-owner');
if(formOwner) {
    formOwner.addEventListener('submit', async (e) => {
        e.preventDefault();
        await deployProject({
            title: document.getElementById('own-title').value,
            description: document.getElementById('own-desc').value,
            type: document.getElementById('own-type').value,
            status: document.getElementById('own-status').value,
            demoUrl: document.getElementById('own-demo').value,
            downloadUrl: document.getElementById('own-download').value,
            byRole: 'owner'
        });
        formOwner.reset();
    });
}

// C. DEPLOY MEMBER (BAYAR $50)
const formMember = document.getElementById('form-project-member');
if(formMember) {
    formMember.addEventListener('submit', async (e) => {
        e.preventDefault();
        const cost = 50;

        // Cek Saldo
        if (currentUserData.credits < cost) {
            alert(`Saldo Kurang! Anda butuh $${cost}, saldo cuma $${currentUserData.credits}.`);
            return;
        }

        const confirmPay = confirm(`Deploy project akan memotong saldo $${cost}. Lanjut?`);
        if(!confirmPay) return;

        try {
            // 1. Potong Saldo di Database
            const newCredits = currentUserData.credits - cost;
            await updateDoc(doc(db, "users", currentUserData.uid), { credits: newCredits });
            
            // 2. Update Tampilan
            document.getElementById('user-credits').innerText = `$${newCredits}`;
            currentUserData.credits = newCredits; 

            // 3. Upload Project
            await deployProject({
                title: document.getElementById('mem-title').value,
                description: document.getElementById('mem-desc').value,
                type: document.getElementById('mem-type').value,
                status: 'unlocked',
                demoUrl: document.getElementById('mem-demo').value,
                downloadUrl: document.getElementById('mem-download').value,
                byRole: 'member',
                uploaderName: currentUserData.name
            });
            formMember.reset();
        } catch (e) { alert("Gagal Transaksi: " + e.message); }
    });
}

async function deployProject(data) {
    try {
        await addDoc(collection(db, "projects"), {
            ...data,
            createdAt: serverTimestamp()
        });
        alert("✅ Project Berhasil Diupload!");
        loadProjects();
    } catch(e) { alert("Error: " + e.message); }
}

// D. FUNGSI DELETE (GLOBAL)
window.deleteProject = async (id) => {
    if(!confirm("Hapus project ini secara permanen?")) return;
    try {
        await deleteDoc(doc(db, "projects", id));
        alert("Project dihapus.");
        loadProjects();
    } catch(e) { alert("Gagal hapus: " + e.message); }
}

// ==========================================
// 6. NEWS SYSTEM (POPUP MODAL)
// ==========================================
async function loadNews() {
    const list = document.getElementById('news-list');
    if(!list) return;

    const q = query(collection(db, "news"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    
    let html = '';
    snap.forEach(doc => {
        const d = doc.data();
        const isImportant = d.type === 'important';
        const badgeClass = isImportant ? 'badge-important' : 'badge-general';
        const itemClass = isImportant ? 'news-item-important' : '';
        const badgeText = isImportant ? '⚠️ PENTING' : 'INFO';
        
        // Escape string agar tidak error di onclick
        const safeTitle = d.title.replace(/'/g, "&apos;");
        const safeDesc = d.content.replace(/'/g, "&apos;");
        const safeLink = d.link || '#';
        const clickEvent = isImportant ? `onclick="window.openNewsModal('${safeTitle}', '${safeDesc}', '${safeLink}')"` : '';

        html += `
            <div class="glass card ${itemClass}" ${clickEvent} style="margin-bottom:15px; padding:15px; border-left: 3px solid #64748b;">
                <div style="display:flex; align-items:center;">
                    <span class="news-badge ${badgeClass}">${badgeText}</span>
                    <h4 style="margin:0; font-size:0.9rem;">${d.title}</h4>
                </div>
                ${!isImportant ? `<p style="margin-top:5px; font-size:0.8rem; color:#aaa;">${d.content}</p>` : ''}
                ${isImportant ? `<small style="color:#ef4444; font-size:0.7rem; margin-top:5px; display:block;">Klik untuk detail & link</small>` : ''}
            </div>`;
    });
    list.innerHTML = html;
}

// Broadcast News (Owner)
const formNews = document.getElementById('form-news');
if(formNews) {
    formNews.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await addDoc(collection(db, "news"), {
                title: document.getElementById('news-title').value,
                content: document.getElementById('news-content').value,
                type: document.getElementById('news-type').value,
                link: document.getElementById('news-link').value,
                createdAt: serverTimestamp()
            });
            alert("Informasi Terkirim!");
            formNews.reset();
            loadNews();
        } catch(e) { alert(e.message); }
    });
}

// Fungsi Buka Modal (Global)
window.openNewsModal = (title, desc, link) => {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-desc').innerText = desc;
    const btnLink = document.getElementById('modal-link');
    
    if(link && link !== '#') {
        btnLink.href = link;
        btnLink.style.display = 'block';
    } else {
        btnLink.style.display = 'none';
    }
    document.getElementById('news-modal').style.display = 'flex';
}

// ==========================================
// 7. PROFILE & LOGOUT
// ==========================================
function loadProfileData(data) {
    // Isi Form Profile jika ada
    if(document.getElementById('edit-name')) {
        document.getElementById('edit-name').value = data.name || "";
        document.getElementById('edit-phone').value = data.phone || "";
        document.getElementById('edit-bio').value = data.bio || "";
        document.getElementById('edit-avatar-url').value = data.photoUrl || "";
        document.getElementById('edit-banner-url').value = data.bannerUrl || "";
        document.getElementById('edit-skills').value = data.skills || "";
    }
    // Update Tampilan Profile
    if(document.getElementById('display-name')) {
        document.getElementById('display-name').innerText = data.name || "User";
        document.getElementById('display-role').innerText = (data.role || "MEMBER").toUpperCase();
        document.getElementById('display-bio').innerText = data.bio || "-";
        if(data.photoUrl) document.getElementById('display-avatar').src = data.photoUrl;
        if(data.bannerUrl) document.getElementById('display-banner').style.backgroundImage = `url('${data.bannerUrl}')`;
        const skillsBox = document.getElementById('display-skills');
        if(skillsBox && data.skills) {
            skillsBox.innerHTML = '';
            data.skills.split(',').forEach(s => { if(s.trim()) skillsBox.innerHTML += `<span class="skill-tag">${s.trim()}</span>`; });
        }
    }
}

// Simpan Profile
const profileForm = document.getElementById('profileForm');
if(profileForm) {
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if(!user) return;
        try {
            await updateDoc(doc(db, "users", user.uid), {
                name: document.getElementById('edit-name').value,
                phone: document.getElementById('edit-phone').value,
                bio: document.getElementById('edit-bio').value,
                photoUrl: document.getElementById('edit-avatar-url').value,
                bannerUrl: document.getElementById('edit-banner-url').value,
                skills: document.getElementById('edit-skills').value
            });
            alert("✅ Profil Update!");
            location.reload();
        } catch (e) { alert("Gagal: " + e.message); }
    });
}

// Logout
document.getElementById('btnLogout')?.addEventListener('click', (e) => {
    e.preventDefault();
    signOut(auth).then(() => window.location.href="index.html");
});
