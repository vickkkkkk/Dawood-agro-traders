import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Search, Plus, User, Key, Shield, UserCog, Edit, Trash2, Mail } from 'lucide-react';
import { getUsers, createUser, updateUser, deleteUser } from '../api/users';
import Card from '../components/ui/Card';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import SearchBar from '../components/ui/SearchBar';
import { useAuth } from '../context/AuthContext';
import { ROLE_COLORS, ROLE_LABELS } from '../utils/constants';
import { formatDate } from '../utils/formatDate';

const UserManagement = () => {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  
  // States
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Modals state
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [userToDeactivate, setUserToDeactivate] = useState(null);

  // Form State & Validation
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('CASHIER');
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState({});

  // Fetch Users
  const { data: usersData, isLoading, isFetching } = useQuery({
    queryKey: ['users', search, page],
    queryFn: () => getUsers({ page, limit, search }),
  });
  const users = Array.isArray(usersData?.data) ? usersData.data : (usersData?.data?.users || usersData?.users || []);
  const totalUsers = usersData?.pagination?.total || usersData?.data?.total || usersData?.total || users.length || 0;
  const totalPages = Math.max(1, Math.ceil(totalUsers / limit));

  // Mutations
  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      toast.success('User account created successfully!');
      queryClient.invalidateQueries(['users']);
      setShowFormModal(false);
      resetForm();
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to create user account');
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }) => updateUser(id, data),
    onSuccess: () => {
      toast.success('User details updated!');
      queryClient.invalidateQueries(['users']);
      setShowFormModal(false);
      resetForm();
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to update user details');
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      toast.success('User deactivated successfully');
      queryClient.invalidateQueries(['users']);
      setShowDeactivateModal(false);
      setUserToDeactivate(null);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to deactivate user');
    }
  });

  // Validation helper
  const validateField = (field, value) => {
    let errs = { ...errors };
    if (field === 'name') {
      if (!value) {
        errs.name = 'Staff name is required';
      } else if (value.trim().length < 3) {
        errs.name = 'Name must be at least 3 characters';
      } else {
        delete errs.name;
      }
    }
    if (field === 'email') {
      if (!value) {
        errs.email = 'Email address is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        errs.email = 'Please enter a valid email address';
      } else {
        delete errs.email;
      }
    }
    if (field === 'password') {
      if (!editingUser && !value) {
        errs.password = 'Password is required';
      } else if (value && value.length < 6) {
        errs.password = 'Password must be at least 6 characters';
      } else {
        delete errs.password;
      }
    }
    if (field === 'role') {
      if (!value) {
        errs.role = 'Role is required';
      } else {
        delete errs.role;
      }
    }
    setErrors(errs);
  };

  // Handlers
  const handleOpenAdd = () => {
    setEditingUser(null);
    resetForm();
    setShowFormModal(true);
  };

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setPassword(''); // Don't autofill password
    setRole(user.role);
    setIsActive(user.isActive);
    setErrors({});
    setShowFormModal(true);
  };

  const resetForm = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setPassword('');
    setRole('CASHIER');
    setIsActive(true);
    setErrors({});
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Run all validations
    const nameErr = !name ? 'Staff name is required' : name.trim().length < 3 ? 'Name must be at least 3 characters' : null;
    const emailErr = !email ? 'Email address is required' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Please enter a valid email address' : null;
    const passwordErr = !editingUser && !password ? 'Password is required' : password && password.length < 6 ? 'Password must be at least 6 characters' : null;
    const roleErr = !role ? 'Role is required' : null;

    if (nameErr || emailErr || passwordErr || roleErr) {
      setErrors({
        name: nameErr,
        email: emailErr,
        password: passwordErr,
        role: roleErr
      });
      toast.error('Please resolve the errors in the form');
      return;
    }

    const data = {
      name,
      email,
      role,
      isActive
    };

    // Include password only if creating user or editing password
    if (!editingUser) {
      data.password = password;
    } else if (password) {
      data.password = password;
    }

    if (editingUser) {
      updateUserMutation.mutate({ id: editingUser.id, data });
    } else {
      createUserMutation.mutate(data);
    }
  };

  const handleOpenDeactivate = (user) => {
    if (user.id === currentUser.id) {
      toast.error('You cannot deactivate yourself!');
      return;
    }
    setUserToDeactivate(user);
    setShowDeactivateModal(true);
  };

  const roleOptions = [
    { value: 'CASHIER', label: 'Cashier Counter Staff' },
    { value: 'MANAGER', label: 'Store Manager' },
    { value: 'ADMIN', label: 'Administrator' },
  ];

  return (
    <div className="app-container animate-fade-in">
      
      {/* Control Filters */}
      <Card compact>
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="w-full sm:w-80">
            <SearchBar
              id="users-search"
              placeholder="Search users by name or email..."
              value={search}
              onChange={(val) => { setSearch(val); setPage(1); }}
            />
          </div>
          <Button
            id="btn-add-user"
            variant="primary"
            icon={Plus}
            onClick={handleOpenAdd}
            className="pos-filter-btn w-full sm:w-auto"
          >
            Create Staff User
          </Button>
        </div>
      </Card>

      {/* List Table */}
      <Card padding={false}>
        <Table
          id="users-table"
          loading={isLoading || isFetching}
          headers={['Staff Member', 'Email Address', 'System Access Role', 'Status', 'Date Joined', 'Actions']}
          onPageChange={setPage}
          currentPage={page}
          totalPages={totalPages}
        >
          {users.length > 0 ? (
            users.map((u) => {
              const rColors = ROLE_COLORS[u.role] || ROLE_COLORS.CASHIER;
              return (
                <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white">
                        <User size={16} />
                      </div>
                      <div>
                        <p className="font-semibold text-white text-sm">{u.name}</p>
                        {u.id === currentUser.id && <span className="text-[10px] text-emerald-400 font-semibold">YOU</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300">
                    {u.email}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold ${rColors.text}`}>
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={u.isActive ? 'success' : 'danger'}>
                      {u.isActive ? 'Active' : 'Disabled'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {formatDate(u.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button
                        id={`btn-edit-user-${u.email}`}
                        variant="secondary"
                        size="sm"
                        icon={Edit}
                        onClick={() => handleOpenEdit(u)}
                        className="p-2"
                      />
                      {u.id !== currentUser.id && u.isActive && (
                        <Button
                          id={`btn-deactivate-user-${u.email}`}
                          variant="danger"
                          size="sm"
                          icon={Trash2}
                          onClick={() => handleOpenDeactivate(u)}
                          className="p-2"
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={6} className="px-7 py-16 text-center text-slate-500">
                No users found
              </td>
            </tr>
          )}
        </Table>
      </Card>

      {/* Create / Edit Form Modal */}
      {showFormModal && (
        <Modal
          id="user-form-modal"
          title={editingUser ? 'Edit User details' : 'Create Staff Member'}
          onClose={() => setShowFormModal(false)}
          size="lg"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowFormModal(false)}>Cancel</Button>
              <Button 
                type="submit" 
                variant="primary"
                form="user-form"
                loading={createUserMutation.isPending || updateUserMutation.isPending}
              >
                {editingUser ? 'Update Profile' : 'Create Profile'}
              </Button>
            </>
          }
        >
          <form id="user-form" onSubmit={handleSubmit} className="space-y-5">
              <Input
                id="user-name"
                label="Staff Member Name *"
                required
                icon={User}
                placeholder="e.g. Ali Khan..."
                value={name}
                error={errors.name}
                onChange={(e) => { setName(e.target.value); if (errors.name) validateField('name', e.target.value); }}
                onBlur={(e) => validateField('name', e.target.value)}
              />
              <Input
                id="user-email"
                label="Email Address *"
                type="email"
                required
                icon={Mail}
                placeholder="e.g. cashier@dawoodagro.com..."
                value={email}
                error={errors.email}
                onChange={(e) => { setEmail(e.target.value); if (errors.email) validateField('email', e.target.value); }}
                onBlur={(e) => validateField('email', e.target.value)}
              />
              <Input
                id="user-password"
                label={editingUser ? 'Change Password (Leave blank to keep old)' : 'Initial Password *'}
                type="password"
                required={!editingUser}
                icon={Key}
                placeholder={editingUser ? 'Enter new password...' : 'Minimum 6 characters...'}
                value={password}
                error={errors.password}
                onChange={(e) => { setPassword(e.target.value); if (errors.password) validateField('password', e.target.value); }}
                onBlur={(e) => validateField('password', e.target.value)}
              />
              
              <Select
                id="user-role"
                label="System Access Role *"
                required
                icon={Shield}
                options={roleOptions}
                value={role}
                error={errors.role}
                onChange={(e) => { setRole(e.target.value); if (errors.role) validateField('role', e.target.value); }}
                onBlur={(e) => validateField('role', e.target.value)}
              />


              {editingUser && (
                <div className="flex items-center gap-3 pt-2">
                  <input
                    id="user-active-toggle"
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded bg-[#161b27] border border-[#2a2f3d] text-[#00e5cc] focus:ring-[#00e5cc] focus:ring-offset-0 cursor-pointer accent-[#00e5cc]"
                  />
                  <label htmlFor="user-active-toggle" className="text-sm font-medium text-slate-300 cursor-pointer">
                    Account Status Active
                  </label>
                </div>
              )}
          </form>
        </Modal>
      )}

      {/* Deactivation Confirm Modal */}
      {showDeactivateModal && userToDeactivate && (
        <Modal
          id="deactivate-confirm-modal"
          title="Disable User Account"
          onClose={() => setShowDeactivateModal(false)}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              Are you sure you want to disable the account of <strong className="text-white">{userToDeactivate.name}</strong>?
            </p>
            <p className="text-xs text-red-400 font-medium">
              ⚠️ The user will be instantly logged out and blocked from logging back into the system. All historical actions logged to their name will remain intact.
            </p>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setShowDeactivateModal(false)}>Cancel</Button>
              <Button 
                variant="danger" 
                onClick={() => deleteUserMutation.mutate(userToDeactivate.id)}
                loading={deleteUserMutation.isPending}
              >
                Confirm Disable
              </Button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};

export default UserManagement;
