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

// --- 🛡️ SECURITY ---
(function(){
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.onkeydown = e => { if(e.keyCode == 123 || (e.ctrlKey && e.shiftKey && (e.keyCode == 73 || e.keyCode == 74)) || (e.ctrlKey && e.keyCode == 85)) return false; };
    setInterval(() => { debugger; }, 1000);
})();

const getVal = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ""; };

// --- 🔑 AUTH & STATE ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const uDoc = await getDoc(doc(db, "users", user.uid));
        if (uDoc.exists()) {
            currentUserData = { ...uDoc.data(), uid: user.uid };
            if(currentUserData.status === 'banned') { alert("DIBLOKIR!"); signOut(auth); return; }
            
            // Sync UI
            syncGlobalUI();
            loadProjects();
            loadNews();
            if (window.location.pathname.includes('profile.html')) loadProfileData(currentUserData);
        }
    } else {
        const prot = ['dashboard.html', 'project.html', 'media.html', 'profile.html', 'user.html'];
        if (prot.some(p => window.location.pathname.includes(p))) window.location.href = "login.html";
    }
});

// Jalankan Visitor View jika di halaman user.html (Tanpa nunggu Auth kelar)
if (window.location.pathname.includes('user.html')) {
    const params = new URLSearchParams(window.location.search);
    const tid = params.get('id');
    if(tid) loadVisitorView(tid);
}

function syncGlobalUI() {
    const names = document.querySelectorAll('#display-name');
    names.forEach(n => n.innerText = currentUserData.name);
    
    const rb = document.getElementById('user-role-badge');
    if(rb) { rb.innerText = currentUserData.role.toUpperCase(); rb.className = "badge role-" + currentUserData.role; }
    
    const uc = document.getElementById('user-credits');
    if(uc) uc.innerText = `$${currentUserData.credits || 0}`;

    const ap = document.getElementById('admin-panel');
    const mp = document.getElementById('member-panel');
    if(currentUserData.role === 'owner') { if(ap) ap.style.display = 'block'; if(mp) mp.style.display = 'none'; }
    else { if(ap) ap.style.display = 'none'; if(mp) mp.style.display = 'block'; }
}

// --- 📡 NEWS SYSTEM (DENGAN MODAL KLIK) ---
async function loadNews() {
    const list = document.getElementById('news-list') || document.getElementById('media-news-list');
    if(!list) return;
    const snap = await getDocs(query(collection(db, "news"), orderBy("createdAt", "desc")));
    let h = '';
    snap.forEach(d => {
        const data = d.data();
        const isPenting = data.type === 'important';
        h += `
        <div class="glass card" style="margin-bottom:15px; border-left: 4px solid ${isPenting?'#ef4444':'#3b82f6'}; cursor:${isPenting?'pointer':'default'}" 
             ${isPenting ? `onclick="window.showNewsDetail('${data.title}','${data.content}','${data.link || ''}')"` : ''}>
            <div style="display:flex; justify-content:space-between;">
                <span class="badge" style="background:${isPenting?'#ef4444':'#3b82f6'}">${isPenting?'⚠️ PENTING':'INFO'}</span>
                <small style="color:gray;">${data.createdAt ? data.createdAt.toDate().toLocaleDateString() : ''}</small>
            </div>
            <h3 style="margin:10px 0;">${data.title}</h3>
            <p style="font-size:0.9rem; color:#ccc;">${data.content.substring(0, 50)}...</p>
            ${isPenting ? `<small style="color:#ef4444;">Klik untuk baca selengkapnya &rarr;</small>` : ''}
        </div>`;
    });
    list.innerHTML = h || '<p>Belum ada berita.</p>';
}

window.showNewsDetail = (t, c, l) => {
    const modal = document.getElementById('news-modal');
    if(!modal) return;
    document.getElementById('modal-title').innerText = t;
    document.getElementById('modal-desc').innerText = c;
    const btn = document.getElementById('modal-link');
    if(l) { btn.href = l; btn.style.display = 'block'; } else { btn.style.display = 'none'; }
    modal.style.display = 'flex';
};

// --- 👤 PROFILE LOGIC (FIX PHOTO & DECO) ---
function loadProfileData(d) {
    const fields = { 'edit-name':'name', 'edit-bio':'bio', 'edit-skills':'skills', 'edit-portfolio':'portfolio', 'edit-avatar-url':'photoUrl', 'edit-banner-url':'bannerUrl', 'edit-phone':'phone' };
    for(let id in fields) { if(document.getElementById(id)) document.getElementById(id).value = d[fields[id]] || ""; }

    const avatar = document.getElementById('display-avatar');
    if(avatar) avatar.src = d.photoUrl || 'https://via.placeholder.com/150';

    const banner = document.getElementById('display-banner');
    if(banner) banner.style.backgroundImage = `url('${d.bannerUrl || ''}')`;

    const frame = document.getElementById('avatar-frame');
    if(frame) frame.className = "avatar-wrapper deco-" + (d.decoration || 'none');
}

// --- 👁️ VISITOR VIEW (user.html) ---
async function loadVisitorView(uid) {
    try {
        const uDoc = await getDoc(doc(db, "users", uid));
        if(uDoc.exists()){
            const d = uDoc.data();
            document.getElementById('v-name').innerText = d.name;
            document.getElementById('v-bio').innerText = d.bio || "No bio yet.";
            document.getElementById('v-avatar').src = d.photoUrl || 'https://via.placeholder.com/150';
            document.getElementById('v-banner').style.backgroundImage = `url('${d.bannerUrl || ''}')`;
            document.getElementById('v-frame').className = "avatar-wrapper deco-" + (d.decoration || 'none');
        }
    } catch(e) { console.error(e); }
}

// --- LOGOUT ---
document.getElementById('btnLogout')?.addEventListener('click', () => signOut(auth).then(() => window.location.href = "login.html"));
