import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { auth } from "./cau-hinh.js";
import { api } from "./api.js";
import { id, thongBao } from "./chung.js";

const trangVaiTro = {
  CUSTOMER: "khach-hang.html",
  STAFF: "nhan-vien.html",
  VET: "bac-si.html",
  ADMIN: "quan-tri.html",
};

export function loiDangNhap(error) {
  const messages = {
    "auth/invalid-credential": "Email hoặc mật khẩu không đúng.",
    "auth/email-already-in-use": "Email đã được đăng ký.",
    "auth/invalid-email": "Email không hợp lệ.",
    "auth/weak-password": "Mật khẩu phải có ít nhất 6 ký tự.",
    "auth/network-request-failed":
      "Không kết nối được Firebase. Hãy kiểm tra Internet.",
    "auth/too-many-requests": "Bạn thử quá nhiều lần. Hãy đợi một lúc.",
  };
  return new Error(
    messages[error?.code] || error?.message || "Không thể đăng nhập.",
  );
}

export function choDangNhap() {
  return new Promise((resolve) => {
    let unsubscribe = () => {};
    unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe();
        resolve(user);
      },
      () => resolve(null),
    );
  });
}

export async function taiHoSo() {
  const user = auth.currentUser;
  if (!user) throw new Error("Bạn cần đăng nhập.");
  let profile;
  try {
    profile = await api.get(`/api/UserAccounts/firebase/${id(user.uid)}`);
  } catch (error) {
    if (error.status !== 404 || !user.email) throw error;
    profile = await api.get(`/api/UserAccounts/email/${id(user.email)}`);
  }
  if (
    user.emailVerified &&
    user.email &&
    profile.email?.toLowerCase() !== user.email.toLowerCase()
  ) {
    profile = await api.post("/api/UserAccounts/sync-email");
  }
  if (profile.status !== "ACTIVE")
    throw new Error("Tài khoản đang bị khóa hoặc tạm ngưng.");
  if (!trangVaiTro[profile.role])
    throw new Error("Vai trò tài khoản không hợp lệ.");
  return profile;
}

export function denTrang(profile) {
  location.replace(`/${trangVaiTro[profile.role]}`);
}

export async function baoVeTrang(role) {
  const user = await choDangNhap();
  if (!user) {
    location.replace("/");
    return null;
  }
  try {
    const profile = await taiHoSo();
    if (profile.role !== role) {
      denTrang(profile);
      return null;
    }
    document.querySelectorAll("[data-ten-nguoi-dung]").forEach((node) => {
      node.textContent = profile.fullName;
    });
    document
      .querySelector("[data-dang-xuat]")
      ?.addEventListener("click", async () => {
        await signOut(auth);
        location.replace("/");
      });
    return profile;
  } catch (error) {
    thongBao(error.message, true);
    document.querySelector("#noi-dung")?.setAttribute("hidden", "");
    document.querySelector("#loi-tai-khoan")?.removeAttribute("hidden");
    return null;
  }
}

export async function dangNhap(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email.trim(), password);
    return await taiHoSo();
  } catch (error) {
    throw loiDangNhap(error);
  }
}

export async function dangKy({ fullName, email, phone, password }) {
  if (password.length < 6) throw new Error("Mật khẩu phải có ít nhất 6 ký tự.");
  const credential = await createUserWithEmailAndPassword(
    auth,
    email.trim(),
    password,
  ).catch((error) => {
    throw loiDangNhap(error);
  });
  await updateProfile(credential.user, { displayName: fullName.trim() });
  return api.post("/api/UserAccounts", {
    userId: "",
    firebaseUid: credential.user.uid,
    fullName: fullName.trim(),
    email: email.trim(),
    phone: phone.trim(),
    role: "CUSTOMER",
    status: "ACTIVE",
    fcmToken: "",
    avatarUrl: "",
    avatarPublicId: "",
  });
}
