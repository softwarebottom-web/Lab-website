import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyCtOhGoiGPHYUgyERjg43pt6_QW-gBjhL4", authDomain: "laboratorium-b4253.firebaseapp.com", projectId: "laboratorium-b4253", storageBucket: "laboratorium-b4253.firebasestorage.app", messagingSenderId: "752575889923", appId: "1:752575889923:web:c0a2fefe62981209c7c436" };
const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app);
let currentUserData = null;

// Security Shield
document.addEventListener('contextmenu', e => e.preventDefault());
document.onkeydown = e => { if(e.keyCode == 123 || (e.ctrlKey && e.shiftKey && (e.keyCode == 73 || e.keyCode == 74)) || (e.ctrlKey && e.keyCode == 85)) return false; };

const getVal = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };

// AUTH & PANEL CONTROL
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const uDoc = await getDoc(doc(db, "users", user.uid));
        if (uDoc.exists()) {
            currentUserData = { ...uDoc.data(), uid: user.uid };
            
            if(currentUserData.status === 'banned') {
                alert("Akun Anda telah di-BAN."); signOut(auth).then(() => window.location.href = "login.html");
                return;
            }

            // Sync Panel
            const ap = document.getElementById('admin-panel'), mp = document.getElementById('member-panel');
            if(currentUserData.role === 'owner') { if(ap) ap.style.display='block'; if(mp) mp.style.display='none'; }
            else { if(ap) ap.style.display='none'; if(mp) mp.style.display='block'; }

            if(document.getElementById('user-role-badge')) document.getElementById('user-role-badge').innerText = currentUserData.role.toUpperCase();
            if(document.getElementById('user-credits')) document.getElementById('user-credits').innerText = `$${currentUserData.credits || 0}`;

            loadProjects(); loadNews();
            if (window.location.pathname.includes('profile')) loadProfileData(currentUserData);
        }
    } else if (!window.location.pathname.includes('login.html')) {
        window.location.href = "login.html";
    }
});

// MODERASI (Owner Only)
window.handleModeration = async (targetUid, action) => {
    if(currentUserData.role !== 'owner') return;
    const ref = doc(db, "users", targetUid);
    if(action === 'ban') await updateDoc(ref, { status: 'banned' });
    else await updateDoc(ref, { warnings: serverTimestamp() });
    alert("Tindakan Berhasil!");
};

// DECORASI PERMANEN
window.buyDecoration = async (decoId) => {
    if (currentUserData.credits < 100) return alert("Kredit Kurang!");
    await updateDoc(doc(db, "users", auth.currentUser.uid), {
        credits: currentUserData.credits - 100,
        decoration: decoId
    });
    alert("Dekorasi Tersimpan Permanen!"); location.reload();
};

async function loadProjects() {
    const list = document.getElementById('project-list'); if(!list) return;
    const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q); let h = '';
    snap.forEach(d => {
        const data = d.data(); const isOwner = currentUserData?.role === 'owner';
        if (data.status === 'private' && !isOwner) return;
        h += `<div class="glass card" style="margin-bottom:15px;">
            <h3 onclick="window.viewProjectDetail('${d.id}')">${data.title} ${data.status==='private'?'🔒':''}</h3>
            <small onclick="window.viewPublicProfile('${data.authorId}')" style="color:#38bdf8;cursor:pointer;">By: ${data.authorName || 'Member'}</small>
        </div>`;
    });
    list.innerHTML = h || '<p>Repository Kosong.</p>';
}

function loadProfileData(d) {
    const fields = ['name', 'phone', 'bio', 'skills', 'portfolio'];
    fields.forEach(f => { if(document.getElementById('edit-'+f)) document.getElementById('edit-'+f).value = d[f] || ""; });
    if(document.getElementById('display-name')) document.getElementById('display-name').innerText = d.name || "User";
    if(document.getElementById('avatar-frame') && d.decoration) document.getElementById('avatar-frame').className = "avatar-wrapper deco-" + d.decoration;
    if(document.getElementById('display-banner')) document.getElementById('display-banner').style.backgroundImage = `url('${d.bannerUrl}')`;
}

document.getElementById('profileForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    await updateDoc(doc(db, "users", auth.currentUser.uid), {
        name: getVal('edit-name'), phone: getVal('edit-phone'), bio: getVal('edit-bio'),
        skills: getVal('edit-skills'), portfolio: getVal('edit-portfolio'),
        photoUrl: getVal('edit-avatar-url'), bannerUrl: getVal('edit-banner-url')
    });
    alert("Profil Updated!"); location.reload();
});

document.getElementById('btnLogout')?.addEventListener('click', () => signOut(auth).then(()=>window.location.href="index.html"));
