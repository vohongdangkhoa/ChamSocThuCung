import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { kiemTraMatKhau } from '../src/quy-tac-mat-khau.js';
import { dangKyKhachHang } from '../src/dang-ky-khach-hang.js';

// Dùng chung fixture với C# để bắt sai khác giữa giao diện và API.
const cases = JSON.parse(readFileSync(new URL('../../qa/mat-khau-cases.json', import.meta.url), 'utf8'));
for (const item of cases) {
  test(`quy tắc mật khẩu: ${item.id}`, () => {
    assert.equal(kiemTraMatKhau(item.password) === null, item.valid);
  });
}

test('mật khẩu sai bị chặn trước mọi lời gọi tạo danh tính/hồ sơ', async () => {
  for (const item of cases.filter((value) => !value.valid)) {
    const services = new Proxy({}, { get() { throw new Error('Không được gọi Firebase/API với mật khẩu sai'); } });
    await assert.rejects(dangKyKhachHang({
      fullName: 'Khách QA', email: 'qa@petnova.invalid', phone: '0123456789', password: item.password,
    }, services), { message: kiemTraMatKhau(item.password) });
  }
});

test('đăng ký giữ nguyên dấu cách trong mật khẩu hợp lệ', async () => {
  for (const password of [' Abcdefgh1!X', 'Abcdefgh1!X ']) {
    let received;
    await dangKyKhachHang({ fullName: 'Khách QA', email: 'qa@petnova.invalid', phone: '0123456789', password }, {
      createIdentity: async (_email, value) => { received = value; return { user: { uid: 'qa-only' } }; },
      updateIdentity: async () => {}, createProfile: async () => ({ userId: 'qa-only' }),
    });
    assert.equal(received, password);
  }
});
