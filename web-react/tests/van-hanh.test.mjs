import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { transformSync } = require('esbuild');
const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let activeHost;

// Chạy component thật với API trì hoãn có kiểm soát, không gọi dữ liệu thật.
const sameDeps = (left, right) => left && right && left.length === right.length
  && left.every((value, index) => Object.is(value, right[index]));
const react = {
  useState(initial) {
    const host = activeHost;
    const index = host.cursor++;
    if (!(index in host.slots)) host.slots[index] = typeof initial === 'function' ? initial() : initial;
    return [host.slots[index], (value) => {
      const next = typeof value === 'function' ? value(host.slots[index]) : value;
      if (!Object.is(next, host.slots[index])) { host.slots[index] = next; host.dirty = true; }
    }];
  },
  useRef(initial) {
    const host = activeHost;
    const index = host.cursor++;
    if (!(index in host.slots)) host.slots[index] = { current: initial };
    return host.slots[index];
  },
  useMemo(factory, dependencies) {
    const host = activeHost;
    const index = host.cursor++;
    const old = host.slots[index];
    if (!old || !sameDeps(old.dependencies, dependencies)) {
      host.slots[index] = { dependencies, value: factory() };
    }
    return host.slots[index].value;
  },
  useCallback(callback, dependencies) { return react.useMemo(() => callback, dependencies); },
  useEffect(effect, dependencies) {
    const host = activeHost;
    const index = host.cursor++;
    const old = host.slots[index];
    if (!old || !sameDeps(old.dependencies, dependencies)) {
      host.slots[index] = { dependencies, cleanup: old?.cleanup };
      host.effects.push(() => {
        host.slots[index].cleanup?.();
        host.slots[index].cleanup = effect();
      });
    }
  },
};
const jsx = (type, props) => ({ type, props: props || {} });

function loadComponent(filename, api, extraExports = '') {
  const source = process.env.PETNOVA_QA_BASELINE === '1'
    ? execFileSync('git', ['show', `${process.env.PETNOVA_QA_BASE_REF || 'e573b91'}:web-react/src/${filename}`], { cwd: webRoot, encoding: 'utf8' })
    : readFileSync(path.join(webRoot, 'src', filename), 'utf8');
  const { code } = transformSync(source + extraExports, { loader: 'jsx', format: 'cjs', jsx: 'automatic' });
  const module = { exports: {} };
  const mockRequire = (name) => {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
    if (name === './giao-tiep-api') return { api, formatError: (error) => error.message };
    if (name.endsWith('.css')) return {};
    return new Proxy({}, { get: () => () => null });
  };
  new Function('require', 'module', 'exports', code)(mockRequire, module, module.exports);
  return module.exports;
}

class Host {
  constructor(component, props = {}) {
    this.component = component; this.props = props; this.slots = []; this.effects = []; this.dirty = true;
  }
  render() {
    let iterations = 0;
    do {
      assert.ok(iterations++ < 40, 'Component không được tạo vòng lặp render/tải dữ liệu');
      this.dirty = false; this.cursor = 0; activeHost = this;
      this.tree = this.component(this.props);
      const effects = this.effects.splice(0);
      effects.forEach((effect) => effect());
    } while (this.dirty);
    return this.tree;
  }
  async settle() {
    for (let index = 0; index < 25; index += 1) {
      await Promise.resolve();
      if (this.dirty) this.render();
    }
  }
}

function nodes(tree, predicate) {
  if (tree == null || typeof tree === 'boolean') return [];
  if (Array.isArray(tree)) return tree.flatMap((child) => nodes(child, predicate));
  if (typeof tree !== 'object') return [];
  if (typeof tree.type === 'function') return nodes(tree.type(tree.props), predicate);
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props.children, predicate)];
}
function text(tree) {
  if (tree == null || typeof tree === 'boolean') return '';
  if (Array.isArray(tree)) return tree.map(text).join('');
  if (typeof tree !== 'object') return String(tree);
  if (typeof tree.type === 'function') return text(tree.type(tree.props));
  return text(tree.props.children);
}
function deferred() {
  let resolve; let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function button(tree, label) {
  const match = nodes(tree, (node) => node.type === 'button' && text(node) === label)[0];
  assert.ok(match, `Không thấy nút ${label}`);
  return match;
}
const user = { userId: 'VET_TEST', role: 'VET', staffId: 'V1', fullName: 'Bác sĩ kiểm thử' };
function vetFixture() {
  const requests = new Map();
  const pets = [
    { petId: 'A', petName: 'Alpha', userId: 'OWNER_A', weight: 2 },
    { petId: 'B', petName: 'Beta', userId: 'OWNER_B', weight: 3 },
  ];
  const api = { get(url) {
    if (url === '/api/Pets') return Promise.resolve(pets);
    if (url === '/api/Staffs/me') return Promise.resolve({ staffId: 'V1' });
    if (url.startsWith('/api/Bookings?')) return Promise.resolve([]);
    const request = deferred(); requests.set(url, request); return request.promise;
  } };
  const { VetPortal } = loadComponent('cong-van-hanh.jsx', api);
  const host = new Host(VetPortal, { user });
  host.render();
  return { host, requests };
}
function selectPet(host, name) {
  host.tree.props.onTabChange('pets'); host.render();
  const card = nodes(host.tree, (node) => node.type === 'article' && nodes(node,
    (child) => child.type === 'h3' && text(child) === name).length > 0)[0];
  assert.ok(card, `Không thấy hồ sơ ${name}`);
  const open = nodes(card, (node) => node.type === 'button')[0];
  open.props.onClick(); host.render();
}
function resolveHistory(requests, petId) {
  requests.get(`/api/MedicalRecords/pet/${petId}`).resolve([
    { recordId: `MR_${petId}`, diagnosis: `Chẩn đoán ${petId}`, treatment: `Điều trị ${petId}`, staffId: 'V1' },
  ]);
  requests.get(`/api/Vaccinations/pet/${petId}`).resolve([
    { vaccinationId: `VC_${petId}`, vaccineName: `Vaccine ${petId}`, staffId: 'V1' },
  ]);
}

test('VET: phản hồi chậm của thú cưng A không đè bệnh án/tiêm chủng B đang chọn', async () => {
  const { host, requests } = vetFixture(); await host.settle();
  selectPet(host, 'Beta'); await host.settle();
  resolveHistory(requests, 'B'); await host.settle();
  assert.match(text(host.tree), /Chẩn đoán B/);
  resolveHistory(requests, 'A'); await host.settle();
  assert.match(text(host.tree), /Chẩn đoán B/);
  assert.doesNotMatch(text(host.tree), /Chẩn đoán A/);
  button(host.tree, 'Tiêm chủng (1)').props.onClick(); host.render();
  assert.match(text(host.tree), /Vaccine B/);
  assert.doesNotMatch(text(host.tree), /Vaccine A/);
});

test('VET: lỗi hồ sơ B không được giữ dữ liệu của A bên dưới tên B', async () => {
  const { host, requests } = vetFixture(); await host.settle();
  resolveHistory(requests, 'A'); await host.settle();
  selectPet(host, 'Beta'); await host.settle();
  requests.get('/api/MedicalRecords/pet/B').reject(new Error('Không thể tải hồ sơ B'));
  await host.settle();
  assert.match(text(host.tree), /Không thể tải hồ sơ B/);
  // Nội dung cũ phải được xóa ở cả hai nhóm, kể cả khi lần tải mới thất bại.
  const clinicalTab = nodes(host.tree, (node) => node.props.role === 'tab' && text(node).startsWith('Bệnh án'))[0];
  assert.equal(text(clinicalTab), 'Bệnh án (0)');
  const vaccinationTab = nodes(host.tree, (node) => node.props.role === 'tab' && text(node).startsWith('Tiêm chủng'))[0];
  assert.equal(text(vaccinationTab), 'Tiêm chủng (0)');
});

test('VET: ngày tiêm không ở tương lai và ngày nhắc lại bắt đầu từ ngày kế tiếp', async () => {
  const { host, requests } = vetFixture(); await host.settle();
  resolveHistory(requests, 'A'); await host.settle();
  selectPet(host, 'Alpha');
  button(host.tree, 'Tiêm chủng (1)').props.onClick(); host.render();
  let inputs = nodes(host.tree, (node) => node.type === 'input' && node.props.type === 'date');
  assert.ok(inputs[0].props.max, 'Ngày tiêm phải có giới hạn không vượt hôm nay');
  inputs[0].props.onChange({ target: { value: '2024-02-29' } }); host.render();
  inputs = nodes(host.tree, (node) => node.type === 'input' && node.props.type === 'date');
  assert.equal(inputs[1].props.min, '2024-03-01');
});

test('Báo cáo: phản hồi khoảng ngày cũ không ghi đè kết quả lần lọc mới', async () => {
  const requests = [];
  const api = { get(url) { const request = deferred(); requests.push({ url, ...request }); return request.promise; } };
  const { __BaoCao } = loadComponent('quan-tri-bo-sung.jsx', api, '\nexport { BaoCao as __BaoCao };');
  const host = new Host(__BaoCao); host.render();
  let inputs = nodes(host.tree, (node) => node.type === 'input' && node.props.type === 'date');
  inputs[0].props.onChange({ target: { value: '2026-01-01' } }); host.render();
  inputs = nodes(host.tree, (node) => node.type === 'input' && node.props.type === 'date');
  inputs[1].props.onChange({ target: { value: '2026-01-31' } }); host.render();
  nodes(host.tree, (node) => node.type === 'form')[0].props.onSubmit({ preventDefault() {} }); host.render();
  assert.match(requests[1].url, /from=2026-01-01&to=2026-01-31/);
  const newer = { from: '2026-01-01', to: '2026-01-31', bookings: 7, completed: 5, paidAmount: 700, refundAmount: 0, byDay: [], byService: [] };
  requests[1].resolve(newer); await host.settle();
  requests[0].resolve({ ...newer, from: '2025-12-01', bookings: 99 }); await host.settle();
  const figures = nodes(host.tree, (node) => node.type === 'strong' && node.props.className === 'stat-number');
  assert.equal(text(figures[0]), '7');
  assert.match(text(host.tree), /2026-01-01/);
  assert.doesNotMatch(text(host.tree), /2025-12-01/);
});

test('Báo cáo: lỗi lần tải mới xóa KPI cũ thay vì gắn với khoảng ngày mới', async () => {
  const requests = [];
  const api = { get() { const request = deferred(); requests.push(request); return request.promise; } };
  const { __BaoCao } = loadComponent('quan-tri-bo-sung.jsx', api, '\nexport { BaoCao as __BaoCao };');
  const host = new Host(__BaoCao); host.render();
  requests[0].resolve({ from: '2026-01-01', to: '2026-01-31', bookings: 7, completed: 5, paidAmount: 700, refundAmount: 0, byDay: [], byService: [] });
  await host.settle();
  nodes(host.tree, (node) => node.type === 'form')[0].props.onSubmit({ preventDefault() {} }); host.render();
  requests[1].reject(new Error('Không thể tải báo cáo mới')); await host.settle();
  assert.match(text(host.tree), /Không thể tải báo cáo mới/);
  assert.equal(nodes(host.tree, (node) => node.props.className === 'stat-number').length, 0);
});
