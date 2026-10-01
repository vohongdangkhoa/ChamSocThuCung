import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  verifyBeforeUpdateEmail,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { auth } from "./cau-hinh.js";
import { api } from "./api.js";
import { h, id, thaoTac, thongBao } from "./chung.js";

export function caiDatTaiKhoan(profile, refresh) {
  const target = document.querySelector("#cai-dat-tai-khoan");
  target.innerHTML = `<div class="cot-2"><div class="khung"><h2>Thông tin cá nhân</h2><form id="form-ho-so" class="form"><label>Họ và tên<input name="fullName" value="${h(profile.fullName)}" required></label><label>Email<input value="${h(profile.email)}" disabled></label><label>Số điện thoại<input name="phone" value="${h(profile.phone)}" required></label><button class="nut">Lưu thay đổi</button></form></div><div class="khung"><h2>Ảnh đại diện</h2>${profile.avatarUrl ? `<img class="anh-thu khoang" src="${h(profile.avatarUrl)}" alt="Ảnh đại diện">` : ""}<form id="form-anh" class="form"><label>Chọn ảnh mới<input name="file" type="file" accept="image/png,image/jpeg,image/webp" required></label><button class="nut nut-phu">Tải ảnh lên</button></form></div><div class="khung"><h2>Đổi mật khẩu</h2><form id="form-mat-khau" class="form"><label>Mật khẩu hiện tại<input name="currentPassword" type="password" required></label><label>Mật khẩu mới<input name="newPassword" type="password" minlength="6" required></label><button class="nut nut-phu">Đổi mật khẩu</button></form></div><div class="khung"><h2>Đổi email</h2><p class="nho">Firebase sẽ gửi thư xác minh tới email mới.</p><form id="form-email" class="form"><label>Email mới<input name="newEmail" type="email" required></label><label>Mật khẩu hiện tại<input name="currentPassword" type="password" required></label><button class="nut nut-phu">Gửi email xác minh</button></form></div></div>`;
  target
    .querySelector("#form-ho-so")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const ok = await thaoTac(
        form.querySelector("button"),
        () =>
          api.put(
            `/api/UserAccounts/update-profile-by-email/${id(profile.email)}`,
            {
              fullName: form.fullName.value.trim(),
              phone: form.phone.value.trim(),
            },
          ),
        "Đã cập nhật hồ sơ.",
      );
      if (ok) refresh();
    });
  target
    .querySelector("#form-anh")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const ok = await thaoTac(
        form.querySelector("button"),
        () => api.upload("/api/Media/avatar", form.file.files[0]),
        "Đã cập nhật ảnh đại diện.",
      );
      if (ok) refresh();
    });
  target
    .querySelector("#form-mat-khau")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      await thaoTac(
        form.querySelector("button"),
        async () => {
          const user = auth.currentUser;
          await reauthenticateWithCredential(
            user,
            EmailAuthProvider.credential(
              user.email,
              form.currentPassword.value,
            ),
          );
          await updatePassword(user, form.newPassword.value);
          form.reset();
        },
        "Đã đổi mật khẩu.",
      );
    });
  target
    .querySelector("#form-email")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      await thaoTac(
        form.querySelector("button"),
        async () => {
          const user = auth.currentUser;
          await reauthenticateWithCredential(
            user,
            EmailAuthProvider.credential(
              user.email,
              form.currentPassword.value,
            ),
          );
          await verifyBeforeUpdateEmail(user, form.newEmail.value.trim());
          form.reset();
        },
        "Đã gửi thư xác minh. Sau khi xác minh, hãy đăng nhập lại bằng email mới.",
      );
    });
}
