import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { LangProvider } from '../contexts/LangContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import Register from '../components/Auth/Register';
import Login from '../components/Auth/Login';
import PendingApplication from '../components/Subscriber/PendingApplication';
import OwnerGenerators from '../components/Owner/OwnerGenerators';
import SupportPage from '../components/Shared/SupportPage';
import AdminAudit from '../components/Admin/AdminAudit';
import { AdminUsers } from '../components/Admin/AdminPages';
import { auditActorLabel } from '../utils/auditActor';

jest.mock('../services/api', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() }));
jest.mock('../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../contexts/ConfirmDialogContext', () => ({ useConfirmDialog: () => jest.fn().mockResolvedValue(false) }));

let root, container, login;
function LocationProbe() { return <output id="test-location">{useLocation().pathname}</output>; }
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers(); jest.clearAllMocks(); localStorage.clear();
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  login = jest.fn(); useAuth.mockReturnValue({ user: { id: 1, role: 'admin' }, login, refreshUser: jest.fn() });
  api.get.mockResolvedValue({ data: [] }); api.post.mockResolvedValue({ data: {} });
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove();
  jest.clearAllTimers(); jest.useRealTimers();
});
async function render(element, language = 'en') {
  localStorage.setItem('lang', language);
  await act(async () => root.render(<LangProvider><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{element}<LocationProbe /></MemoryRouter></LangProvider>));
}
async function change(element, value) {
  await act(async () => Simulate.change(element, { target: { name: element.name, value } }));
}
async function click(element) { await act(async () => Simulate.click(element)); }
async function submit(element) { await act(async () => Simulate.submit(element)); }

test('FR-002 registration is available without loading or choosing a provider', async () => {
  await render(<Register />);
  expect(api.get).not.toHaveBeenCalled();
  expect(document.querySelector('[name="generator_id"]')).toBeNull();
  expect(document.querySelector('[name="location_address"]')).toBeNull();
  expect(document.querySelector('#register-name')).not.toBeNull();
  expect(document.querySelector('form').checkValidity()).toBe(false);
});

test('FR-002 signup sends account details only, then offers sign-in', async () => {
  await render(<Register />);
  for (const [id, value] of [['name', 'QA New User'], ['username', 'qanewuser'], ['phone', '+96171123456'], ['password', 'Abc123!x']]) await change(document.querySelector('#register-' + id), value);
  expect(document.querySelector('form').checkValidity()).toBe(true);
  await submit(document.querySelector('form'));
  expect(api.post).toHaveBeenCalledWith('/auth/register', expect.objectContaining({ username: 'qanewuser', password: 'Abc123!x' }));
  expect(api.post.mock.calls[0][1]).not.toHaveProperty('generator_id');
  expect(document.body.textContent).toContain('Account created. Sign in');
});

test('FR-043 the signup form accepts a strong eight-character password and rejects weak forms', async () => {
  await render(<Register />); const field = document.querySelector('#register-password');
  expect(field.minLength).toBe(8); const rule = new RegExp('^(?:' + field.pattern + ')$', 'v');
  expect(rule.test('Abc123!x')).toBe(true);
  for (const weak of ['Ab1!xyz', '12345678', 'abcdefgh', 'ABCDEFGH', 'Pass1234', 'Abc123! ']) expect(rule.test(weak)).toBe(false);
});

test.each(['admin', 'owner', 'collector', 'subscriber'])('FR-001 login routes the %s role correctly', async role => {
  login.mockResolvedValue({ role }); await render(<Login />);
  await change(document.querySelector('#login-username'), ' qauser '); await change(document.querySelector('#login-password'), 'Abc123!x');
  await submit(document.querySelector('form'));
  expect(login).toHaveBeenCalledWith('qauser', 'Abc123!x'); expect(document.querySelector('#test-location').textContent).toBe('/' + role);
});

test('FR-001 failed login displays a generic error and keeps the sign-in page', async () => {
  login.mockRejectedValue({ response: { data: { error: 'Invalid credentials' } } }); await render(<Login />);
  await change(document.querySelector('#login-username'), 'qauser'); await change(document.querySelector('#login-password'), 'Wrong123!');
  await submit(document.querySelector('form'));
  expect(document.querySelector('.alert-danger').textContent).toContain('Invalid credentials'); expect(document.body.textContent).not.toContain('Wrong123!');
});

test('FR-002 no available generators is an onboarding state after account creation', async () => {
  await render(<PendingApplication application={{ status: 'unselected' }} onRefresh={jest.fn()} />);
  expect(api.get).toHaveBeenCalledWith('/subscriber/registration-destinations');
  expect(document.body.textContent).toContain('Your account is ready');
  expect(document.body.textContent).toContain('No service areas');
});

test('FR-002 a signed-in subscriber selects the provider and installation address', async () => {
  api.get.mockResolvedValue({ data: [{ id: 7, name: 'QA Generator', location_name: 'QA area', provider_name: 'QA Provider' }] });
  const refreshed = jest.fn(); await render(<PendingApplication application={{ status: 'unselected' }} onRefresh={refreshed} />);
  await change(document.querySelector('#application-generator'), '7'); await change(document.querySelector('#application-address'), 'QA installation address');
  await submit(document.querySelector('form'));
  expect(api.post).toHaveBeenCalledWith('/subscriber/registration-application', { generator_id: 7, location_address: 'QA installation address' });
  expect(refreshed).toHaveBeenCalledTimes(1);
});

test('FR-007 generator creation does not request a meter number', async () => {
  await render(<OwnerGenerators />);
  await click([...document.querySelectorAll('button')].find(b => /Add Generator/.test(b.textContent)));
  const form = document.querySelector('#genForm'); expect(form).not.toBeNull();
  expect(form.textContent).not.toMatch(/meter|عداد/i);
});

test('FR-040 support tickets expose a focusable control and a named reply button', async () => {
  const ticket = { id: 1, subject: 'QA access', status: 'open', category: 'technical', priority: 'low', description: 'QA record', created_at: '2026-11-14T00:00:00Z', updated_at: '2026-11-14T00:00:00Z', replies: [] };
  api.get.mockImplementation(url => Promise.resolve({ data: url === '/support/tickets' ? [ticket] : ticket }));
  await render(<SupportPage />); const opener = document.querySelector('button[aria-label="Open ticket: QA access"]');
  expect(opener).not.toBeNull(); opener.focus(); expect(document.activeElement).toBe(opener);
  await click(opener); expect(document.querySelector('button[aria-label="Send reply"]')).not.toBeNull();
});

test('FR-045 audit rows display an available actor name instead of only the numeric ID', async () => {
  api.get.mockResolvedValue({ data: [{ id: 1, user_id: 8, full_name: 'QA Administrator', action: 'LOGIN_SUCCESS', created_at: '2026-11-14T00:00:00Z' }] });
  await render(<AdminAudit />); expect(document.body.textContent).toContain('QA Administrator');
  expect(auditActorLabel({ username: 'qauser', user_id: 8 })).toBe('qauser'); expect(auditActorLabel({ user_id: 8 })).toBe('8'); expect(auditActorLabel({})).toBe('System');
});

test('FR-046 Arabic user management translates the observed English controls', async () => {
  api.get.mockResolvedValue({ data: { users: [{ id: 1, full_name: 'QA Admin', username: 'qaadmin', role: 'admin', is_active: 1 }], total: 1 } });
  await render(<AdminUsers />, 'ar'); await act(async () => jest.advanceTimersByTime(400));
  const text = document.body.textContent;
  expect(text).toContain('إنشاء مستخدم'); expect(text).toContain('جميع الأدوار'); expect(text).toContain('حساب مدير محمي');
  expect(text).not.toContain('Create User'); expect(text).not.toContain('Protected admin'); expect(document.documentElement.dir).toBe('rtl');
});
