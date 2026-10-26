import test from 'node:test';
import assert from 'node:assert/strict';
import { chuanHoaSoDienThoai, dangKyKhachHang } from '../src/dang-ky-khach-hang.js';

const input = { fullName: '  Khách QA  ', email: 'qa@petnova.invalid', phone: '0123456789', password: 'qa123456' };
function fixture(overrides = {}) {
  const calls = [];
  const user = { uid: 'qa-new-identity', email: input.email };
  const services = {
    createIdentity: async () => { calls.push('firebase-create'); return { user }; },
    updateIdentity: async () => { calls.push('firebase-profile'); },
    createProfile: async (profile) => { calls.push('sql-create'); return { ...profile, userId: 'QA1' }; },
    removeIdentity: async (identity) => { assert.equal(identity, user); calls.push('firebase-delete-new'); },
    ...overrides,
  };
  return { calls, services, user };
}

test('chuẩn hóa số trong nước/quốc tế nhất quán với khóa tra cứu +84', () => {
  for (const phone of ['0123456789', '123456789', '+84123456789', '84123456789', '0084123456789', '(0123) 456-789'])
    assert.equal(chuanHoaSoDienThoai(phone), '+84123456789');
  for (const phone of ['', '0000000000', 'abc0123456789', '01234567890', '0123+456789', '+33123456789'])
    assert.equal(chuanHoaSoDienThoai(phone), null);
});
test('dữ liệu sai bị chặn trước khi tạo danh tính Firebase', async () => {
  for (const data of [{ phone: 'sai' }, { fullName: ' ' }, { fullName: 'a'.repeat(101) },
    { email: 'sai' }, { email: 'a'.repeat(100) + '@a.vn' }, { password: '12345' }]) {
    const f = fixture();
    await assert.rejects(dangKyKhachHang({ ...input, ...data }, f.services));
    assert.deepEqual(f.calls, []);
  }
});
test('đăng ký hợp lệ tạo hồ sơ CUSTOMER ACTIVE và giữ danh tính mới', async () => {
  const f = fixture();
  const result = await dangKyKhachHang(input, f.services);
  assert.equal(result.account.phone, '+84123456789');
  assert.equal(result.account.fullName, 'Khách QA');
  assert.equal(result.account.role, 'CUSTOMER');
  assert.deepEqual(f.calls, ['firebase-create', 'firebase-profile', 'sql-create']);
});
test('API từ chối số trùng không để lại email Firebase bị chiếm bởi đăng ký lỗi', async () => {
  const rejected = Object.assign(new Error('Số điện thoại đã được liên kết'), { status: 400 });
  const f = fixture({ createProfile: async () => { throw rejected; } });
  await assert.rejects(dangKyKhachHang(input, f.services), (error) => error === rejected);
  assert.deepEqual(f.calls, ['firebase-create', 'firebase-profile', 'firebase-delete-new']);
});
test('email đã dùng: không xóa danh tính có sẵn khi Firebase từ chối tạo', async () => {
  const f = fixture({ createIdentity: async () => { throw new Error('auth/email-already-in-use'); } });
  await assert.rejects(dangKyKhachHang(input, f.services), /email-already-in-use/);
  assert.deepEqual(f.calls, []);
});
test('lỗi cập nhật tên Firebase trước SQL dọn đúng tài khoản vừa tạo', async () => {
  const f = fixture({ updateIdentity: async () => { throw new Error('update failed'); } });
  await assert.rejects(dangKyKhachHang(input, f.services), /update failed/);
  assert.deepEqual(f.calls, ['firebase-create', 'firebase-delete-new']);
});
test('lỗi mạng hoặc 5xx sau POST không được xóa danh tính khi SQL có thể đã lưu', async () => {
  for (const status of [0, 500, 503]) {
    const f = fixture({ createProfile: async () => { throw Object.assign(new Error('connection lost'), { status }); } });
    await assert.rejects(dangKyKhachHang(input, f.services), /connection lost/);
    assert.deepEqual(f.calls, ['firebase-create', 'firebase-profile']);
  }
});
