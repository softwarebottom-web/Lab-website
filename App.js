import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = { 
    apiKey: "AIzaSyCtOhGoiGPHYUgyERjg43pt6_QW-gBjhL4", 
    authDomain: "laboratorium-b4253.firebaseapp.com", 
    projectId: "laboratorium-b4253",
    storageBucket: "laboratorium-b4253.firebasestorage.app"
};

const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app);
let currentUserData = null;

// --- PROTEKSI ANTI-MALING ---
(function(){
    document.addEventListener('contextmenu',e=>e.preventDefault());
    document.onkeydown=e=>{if(e.keyCode==123||(e.ctrlKey&&e.shiftKey&&(e.keyCode==73||e.keyCode==74))||(e.ctrlKey&&e.keyCode==85))return false};
    setInterval(()=>{debugger;},500);
})();

const getVal=(id)=>{const el=document.getElementById(id);return el?el.value:""};

// --- AUTH & PANEL SYNC ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const uDoc = await getDoc(doc(db, "users", user.uid));
        if (uDoc.exists()) {
            currentUserData = { ...uDoc.data(), uid: user.uid };
            
            // Sync UI
            const ap=document.getElementById('admin-panel'), mp=document.getElementById('member-panel');
            if(document.getElementById('user-role-badge')) {
                const rb = document.getElementById('user-role-badge');
                rb.innerText = currentUserData.role.toUpperCase();
                rb.className = "badge role-" + currentUserData.role;
            }
            if(document.getElementById('user-credits')) document.getElementById('user-credits').innerText = `$${currentUserData.credits || 0}`;
            
            if(currentUserData.role==='owner'){ if(ap)ap.style.display='block'; if(mp)mp.style.display='none'; }
            else { if(ap)ap.style.display='none'; if(mp)mp.style.display='block'; }

            loadProjects();
            loadNews();
            if (window.location.pathname.includes('profile.html')) loadProfileData(currentUserData);
            if (window.location.pathname.includes('user.html')) loadVisitorView();
        }
    } else {
        const prot = ['dashboard.html', 'project.html', 'media.html', 'profile.html', 'user.html'];
        if (prot.some(p => window.location.pathname.includes(p))) window.location.href = "login.html";
    }
});

// --- NEWS SYSTEM (LOAD & POST) ---
async function loadNews() {
    const list = document.getElementById('news-list');
    if(!list) return;
    try {
        const q = query(collection(db, "news"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        let h = '';
        snap.forEach(d => {
            const data = d.data();
            h += `
            <div class="glass card" style="margin-bottom:15px; border-left: 4px solid #facc15;">
                <div style="display:flex; justify-content:space-between;">
                    <span class="badge" style="background:rgba(250,204,21,0.2); color:#facc15;">${data.category || 'UPDATE'}</span>
                    <small style="color:#666;">${data.createdAt ? data.createdAt.toDate().toLocaleDateString() : ''}</small>
                </div>
                <h3 style="margin:10px 0;">${data.title}</h3>
                <p style="font-size:0.9rem; color:#ccc;">${data.content}</p>
                ${currentUserData?.role === 'owner' ? `<button onclick="window.delNews('${d.id}')" style="background:none; border:none; color:red; cursor:pointer; font-size:0.8rem; margin-top:10px;">Hapus Berita</button>` : ''}
            </div>`;
        });
        list.innerHTML = h || '<p style="text-align:center; padding:20px;">Belum ada berita terbaru.</p>';
    } catch (e) { list.innerHTML = "Error loading news."; }
}

// Handler Post News (Tambahkan Form dengan ID 'form-news' di HTML Media)
const fNews = document.getElementById('form-news');
if(fNews) fNews.addEventListener('submit', async (e) => {
    e.preventDefault();
    if(currentUserData.role !== 'owner') return;
    try {
        await addDoc(collection(db, "news"), {
            title: getVal('news-title'),
            content: getVal('news-content'),
            category: getVal('news-category'),
            createdAt: serverTimestamp()
        });
        alert("Berita Berhasil Dipublish!");
        location.reload();
    } catch (err) { alert(err.message); }
});

window.delNews = async(id)=>{if(confirm("Hapus berita?")){await deleteDoc(doc(db,"news",id));loadNews()}};

// --- REPOSITORY & PROFILE LOGIC (Seperti sebelumnya tapi dipastikan stabil) ---
async function loadProjects() {
    const list = document.getElementById('project-list'); if(!list) return;
    try {
        const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        let h = '';
        snap.forEach(d => {
            const data = d.data();
            if (data.status === 'private' && currentUserData?.role !== 'owner') return;
            h += `<div class="glass card">
                <h3>${data.title} ${data.status==='private'?'🔒':''}</h3>
                <p style="font-size:0.85rem; color:#aaa; margin:10px 0;">${data.description}</p>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <a href="${data.downloadUrl}" target="_blank" class="btn btn-primary" style="padding:5px 15px;">${data.type==='github'?'GitHub':'Download'}</a>
                    <small onclick="window.location.href='user.html?id=${data.authorId}'" style="cursor:pointer; color:#38bdf8;">By: ${data.authorName}</small>
                </div>
            </div>`;
        });
        list.innerHTML = h || '<p>Repository Kosong.</p>';
    } catch(e) { console.log(e); }
}

// Sisanya (Profile & Visitor) tetap sama...
window.delProj = async(id)=>{if(confirm("Hapus?")){await deleteDoc(doc(db,"projects",id));loadProjects()}};
const pForm = document.getElementById('profileForm');
if(pForm) pForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await updateDoc(doc(db, "users", auth.currentUser.uid), {
        name: getVal('edit-name'), bio: getVal('edit-bio'), skills: getVal('edit-skills'),
        portfolio: getVal('edit-portfolio'), photoUrl: getVal('edit-avatar-url'), bannerUrl: getVal('edit-banner-url')
    });
    alert("Saved!"); location.reload();
});
document.getElementById('btnLogout')?.addEventListener('click',()=>signOut(auth).then(()=>window.location.href="index.html"));
