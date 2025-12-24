const CONTRACT_ADDRESS = "0xdDda8234D69eb05893b773fb5138B9DC5B0eb65c";

const ABI = [
  "function issueCertificate(bytes32,string,string)",
  "function verifyCertificate(bytes32) view returns (bool,bool,address,uint256,bool,string,string)"
];

let provider, signer, contract;
let currentHash = "";

const connectWalletBtn = document.getElementById("connectWallet");

connectWalletBtn.onclick = async () => {
  if (!window.ethereum) {
    showToast("MetaMask tidak ditemukan");
    return;
  }

  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

    document.getElementById("account").innerText = await signer.getAddress();
    const network = await provider.getNetwork();
    document.getElementById("network").innerText = network.name;

    // optional: glow logo kalau kamu sudah pakai
    document.getElementById("chainLogo")?.classList.add("isConnected");

    // optional: tombol berubah
    connectWalletBtn.innerText = "Connected";
    connectWalletBtn.disabled = true;

    showToast("Metamask berhasil terhubung ✅");
  } catch (err) {
    console.error(err);

    // kasus umum: user klik "Cancel"
    if (err?.code === 4001) {
      showToast("Koneksi dibatalkan");
    } else {
      showToast("Gagal menghubungkan wallet");
    }
  }
};


// connectWalletBtn.onclick = async () => {
//   if (!window.ethereum) return alert("MetaMask not found");

//   provider = new ethers.BrowserProvider(window.ethereum);
//   await provider.send("eth_requestAccounts", []);
//   signer = await provider.getSigner();
//   contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

//   document.getElementById("account").innerText = await signer.getAddress();
//   const network = await provider.getNetwork();
//   document.getElementById("network").innerText = network.name;
// };

document.getElementById("generateHash").onclick = async () => {
  const file = document.getElementById("fileInput").files[0];

  if (!file) {
    showToast("Silahkan pilih file terlebih dahulu");
    return;
  }

  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  currentHash =
    "0x" + hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

  document.getElementById("hashResult").innerText = currentHash;
};

document.getElementById("issueCert").onclick = async () => {
  const docType = document.getElementById("docType").value;
  const holderId = document.getElementById("holderId").value;

  // 1) kalau belum connect
  if (!signer || !contract) {
    showToast("Hubungkan Metamask🦊");
    return;
  }

  // 2) kalau hash belum ada
  if (!currentHash) {
    showToast("Hash masih kosong. Klik Generate Hash dulu.");
    return;
  }

  try {
    showToast("Menyimpan hash ke blockchain…");

    const tx = await contract.issueCertificate(currentHash, docType, holderId);
    document.getElementById("txHash").innerText = tx.hash;

    showToast("Transaksi terkirim ✅");

    await tx.wait();
    showToast("Berhasil disimpan ✅");

  } catch (err) {
    const msg = (err?.message || "").toLowerCase();

    // 3) kalau hash/file sudah pernah disimpan (duplikat) -> revert
    if (msg.includes("revert") || msg.includes("already") || msg.includes("exist")) {
      showToast("File sudah digunakan / sudah pernah disimpan di blockchain.");
      return;
    }

    // 4) kalau user cancel di metamask
    if (msg.includes("user rejected")) {
      showToast("Transaksi dibatalkan.");
      return;
    }

    // fallback error lain
    showToast("Gagal menyimpan. Coba lagi.");
    console.error(err);
  }
};

document.getElementById("verifyCert").onclick = async () => {
  const hash = document.getElementById("verifyHash").value.trim();

  // 1) Cek wallet
  if (!signer || !contract) {
    showToast("Hubungkan Metamask🦊");
    return;
  }

  // 2) Cek input
  if (!hash) {
    showToast("Masukkan hash dokumen terlebih dahulu");
    return;
  }

  // 3) Validasi format hash (SHA-256 => 32 bytes => 64 hex chars, + '0x')
  const okFormat = /^0x[a-fA-F0-9]{64}$/.test(hash);
  if (!okFormat) {
    showToast("Format hash tidak valid (harus 0x + 64 karakter hex)");
    return;
  }

  try {
    const result = await contract.verifyCertificate(hash);
    const valid = result[1];

    document.getElementById("verifyResult").innerHTML =
      valid
        ? "<span class='valid'>VALID CERTIFICATE</span>"
        : "<span class='invalid'>INVALID OR REVOKED CERTIFICATE</span>";

    showToast(valid ? "Sertifikat VALID ✅" : "Sertifikat tidak valid / revoked ❌");
  } catch (err) {
    console.error(err);
    showToast("Gagal verifikasi. Pastikan network & hash sudah benar");
  }
};

// ===== Show selected file name =====
const fileNameEl = document.getElementById("fileName");
const fileInputEl = document.getElementById("fileInput");

function updateFileNameUI(file){
  if (!fileNameEl) return;
  if (!file) {
    fileNameEl.innerText = "Belum ada file";
    return;
  }
  const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
  fileNameEl.innerText = `${file.name} • ${sizeMB} MB`;
}

// saat pilih file via dialog
fileInputEl?.addEventListener("change", () => {
  updateFileNameUI(fileInputEl.files?.[0]);
});



// ===== Toast Helper =====
function showToast(message){
  const toast = document.getElementById("toast");
  const msg = document.getElementById("toastMsg");
  if (!toast || !msg) return;

  msg.innerText = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 5000);
}

// ===== Use Generated Hash for Verify =====

// ===== Use Generated Hash for Verify (robust) =====
window.addEventListener("DOMContentLoaded", () => {
  const useHashBtn = document.getElementById("useGeneratedHash");
  const verifyInput = document.getElementById("verifyHash");

  if (!useHashBtn || !verifyInput) {
    console.warn("useGeneratedHash / verifyHash not found");
    return;
  }

  useHashBtn.addEventListener("click", () => {
    if (!currentHash) {
      showToast("Belum ada hash yang digenerate");
      return;
    }

    verifyInput.value = currentHash;
    verifyInput.focus();
    showToast("Hash dimasukkan ke kolom verifikasi");
  });
});
