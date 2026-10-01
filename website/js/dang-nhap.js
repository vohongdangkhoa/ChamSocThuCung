import { auth } from "./cau-hinh.js";
import { goiApi } from "./api.js";
import {
  dangKy,
  dangNhap,
  denTrang,
  choDangNhap,
  taiHoSo,
} from "./xac-thuc.js";
import { thaoTac, thongBao } from "./chung.js";

let challengeId = "";
let resetToken = "";

function hienForm(name) {
  document.querySelectorAll("[data-form]").forEach((form) => {
    form.hidden = form.dataset.form !== name;
  });
  document
    .querySelectorAll("[data-chon-form]")
    .forEach((button) =>
      button.classList.toggle("dang-chon", button.dataset.chonForm === name),
    );
  thongBao("");
}

document
  .querySelectorAll("[data-chon-form]")
  .forEach((button) =>
    button.addEventListener("click", () => hienForm(button.dataset.chonForm)),
  );

document
  .querySelector("#form-dang-nhap")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    await thaoTac(form.querySelector("button[type=submit]"), async () => {
      const profile = await dangNhap(form.email.value, form.password.value);
      denTrang(profile);
    });
  });

document
  .querySelector("#form-dang-ky")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.password.value !== form.confirmPassword.value) {
      thongBao("Hai mật khẩu không khớp.", true);
      return;
    }
    await thaoTac(form.querySelector("button[type=submit]"), async () => {
      const profile = await dangKy({
        fullName: form.fullName.value,
        email: form.email.value,
        phone: form.phone.value,
        password: form.password.value,
      });
      denTrang(profile);
    });
  });

document
  .querySelector("#form-otp-yeu-cau")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    await thaoTac(form.querySelector("button"), async () => {
      const result = await goiApi("/api/auth/password-reset/request", {
        method: "POST",
        body: { phone: form.phone.value.trim() },
        publicAccess: true,
      });
      challengeId = result.challengeId;
      document.querySelector("#email-nhan-otp").textContent =
        result.maskedEmail || "email liên kết";
      hienForm("otp-xac-minh");
      thongBao("Đã gửi mã OTP. Hãy kiểm tra email.");
    });
  });
document
  .querySelector("#form-otp-xac-minh")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    await thaoTac(form.querySelector("button"), async () => {
      const result = await goiApi("/api/auth/password-reset/verify", {
        method: "POST",
        body: { challengeId, otp: form.otp.value.trim() },
        publicAccess: true,
      });
      resetToken = result.resetToken;
      hienForm("otp-hoan-tat");
    });
  });
document
  .querySelector("#form-otp-hoan-tat")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.password.value !== form.confirmPassword.value) {
      thongBao("Hai mật khẩu không khớp.", true);
      return;
    }
    await thaoTac(form.querySelector("button"), async () => {
      await goiApi("/api/auth/password-reset/complete", {
        method: "POST",
        body: { challengeId, resetToken, newPassword: form.password.value },
        publicAccess: true,
      });
      hienForm("dang-nhap");
      thongBao("Đã đổi mật khẩu. Hãy đăng nhập lại.");
    });
  });

const user = await choDangNhap();
if (user) {
  try {
    denTrang(await taiHoSo());
  } catch (error) {
    if (auth.currentUser) thongBao(error.message, true);
  }
}
