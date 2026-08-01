'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Mail,
  Calendar,
  Lock,
  LogOut,
  KeyRound,
  Camera,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Upload,
  Trash2,
  ChevronRight,
  RefreshCw,
  Save
} from 'lucide-react';

// Services
import { getCurrentProfile, updateDisplayName, uploadAvatar, removeAvatar } from '@/services/profileService';
import { updateAccountPassword } from '@/services/accountService';

// Validation
import { validatePasswordMatch } from '@/lib/validation/password';

// Types & Errors
import type { UserProfile } from '@/services/profileService';
import { ProfileServiceError, AvatarUploadError, DisplayNameValidationError } from '@/services/profileErrors';
import { PasswordUpdateError } from '@/services/accountErrors';

// Components
import { SignOutButton } from '@/components/auth/sign-out-button';

export function AccountPage() {
  const router = useRouter();

  // Profile state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Logout confirmation state
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Load profile on mount
  useEffect(() => {
    let isActive = true;

    const loadProfile = async () => {
      try {
        const profileData = await getCurrentProfile();
        if (isActive && profileData) {
          setProfile(profileData);
          setDisplayName(profileData.displayName || '');
          setIsLoadingProfile(false);
        }
      } catch (err) {
        console.error('Load profile error:', err);
        if (isActive) {
          setIsLoadingProfile(false);
        }
      }
    };

    loadProfile();

    return () => {
      isActive = false;
    };
  }, []);

  // Cleanup avatar preview URL on unmount
  useEffect(() => {
    return () => {
      if (avatarPreview && avatarPreview.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  // Toast helper
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // File select handler
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Revoke previous preview URL
    if (avatarPreview && avatarPreview.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreview);
    }

    // Create preview
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
    setSelectedFile(file);
    setProfileError(null);
  };

  // Avatar upload handler
  const handleAvatarUpload = async () => {
    if (!selectedFile || isUploadingAvatar) return;

    setProfileError(null);
    setProfileSuccess(null);
    setIsUploadingAvatar(true);

    try {
      const updatedProfile = await uploadAvatar(selectedFile);
      setProfile(updatedProfile);
      setDisplayName(updatedProfile.displayName || '');

      // Clear selection and preview
      setSelectedFile(null);
      if (avatarPreview && avatarPreview.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreview);
      }
      setAvatarPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      showNotification('Ảnh đại diện đã được cập nhật. ✨');
    } catch (err) {
      console.error('Avatar upload error:', err);
      if (err instanceof AvatarUploadError) {
        setProfileError(err.userMessage);
      } else if (err instanceof ProfileServiceError) {
        setProfileError(err.userMessage);
      } else {
        setProfileError('Không thể tải ảnh lên. Vui lòng thử lại.');
      }
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Avatar remove handler
  const handleAvatarRemove = async () => {
    if (isRemovingAvatar || !profile?.avatarPath) return;

    setProfileError(null);
    setProfileSuccess(null);
    setIsRemovingAvatar(true);

    try {
      const updatedProfile = await removeAvatar();
      setProfile(updatedProfile);
      showNotification('Ảnh đại diện đã được xóa.');
    } catch (err) {
      console.error('Avatar remove error:', err);
      if (err instanceof ProfileServiceError) {
        setProfileError(err.userMessage);
      } else {
        setProfileError('Không thể xóa ảnh đại diện. Vui lòng thử lại.');
      }
    } finally {
      setIsRemovingAvatar(false);
    }
  };

  // Profile save handler
  const handleProfileSave = async () => {
    if (isSavingProfile) return;

    setProfileError(null);
    setProfileSuccess(null);
    setIsSavingProfile(true);

    try {
      // Upload avatar if selected
      if (selectedFile) {
        await handleAvatarUpload();
      }

      // Update display name if changed
      if (profile && displayName !== profile.displayName) {
        const updatedProfile = await updateDisplayName(displayName);
        setProfile(updatedProfile);
        setDisplayName(updatedProfile.displayName || '');
        showNotification('Hồ sơ đã được cập nhật. ✨');
      } else if (!selectedFile) {
        showNotification('Không có thay đổi nào.');
      }
    } catch (err) {
      console.error('Profile save error:', err);
      if (err instanceof DisplayNameValidationError) {
        setProfileError(err.userMessage);
      } else if (err instanceof ProfileServiceError) {
        setProfileError(err.userMessage);
      } else {
        setProfileError('Không thể lưu hồ sơ. Vui lòng thử lại.');
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Password change handler
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmittingPassword) return;

    setPasswordError(null);
    setPasswordSuccess(null);

    // Client validation
    const validation = validatePasswordMatch(newPassword, confirmPassword);
    if (!validation.valid) {
      setPasswordError(validation.message || 'Mật khẩu không hợp lệ');
      return;
    }

    setIsSubmittingPassword(true);

    try {
      await updateAccountPassword(newPassword);

      // Clear form
      setNewPassword('');
      setConfirmPassword('');

      // Show success
      showNotification('Cập nhật mật khẩu bảo mật thành công! 🔐');
      setPasswordSuccess('Đổi mật khẩu thành công');
    } catch (err) {
      console.error('Password change error:', err);

      if (err instanceof PasswordUpdateError) {
        setPasswordError(err.userMessage);
      } else {
        setPasswordError('Không thể cập nhật mật khẩu. Vui lòng thử lại.');
      }
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  // Logout handler
  const handleLogout = () => {
    setShowLogoutConfirm(false);
    // SignOutButton handles the actual logout
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 sm:py-8 space-y-8 pb-16 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-bold text-white transition-all animate-in slide-in-from-bottom-5 duration-200 ${
          toast.type === 'success' ? 'bg-emerald-600 shadow-emerald-200' : 'bg-rose-600 shadow-rose-200'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Page Title & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#FCE7F3] pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#F472B6] uppercase tracking-wider mb-1">
            <User className="w-4 h-4" />
            <span>Tài khoản cá nhân</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
            Quản Lý Hồ Sơ & Bảo Mật
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Cập nhật thông tin cá nhân, cài đặt bảo mật mật khẩu và quản lý phiên đăng nhập tài khoản.
          </p>
        </div>

        <button
          onClick={() => router.push('/app')}
          className="self-start sm:self-auto px-4 py-2 rounded-xl bg-white border border-[#FCE7F3] hover:bg-[#FFF1F2] text-xs font-bold text-slate-700 transition-all cursor-pointer shadow-2xs flex items-center gap-2"
        >
          <span>Quay lại Trang Chủ</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Main Grid: Left Column (Avatar Card), Right Column (Forms) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column: Avatar & Basic Info Card */}
        <div className="lg:col-span-1 space-y-6">
          {/* Avatar Card */}
          <div className="bg-white rounded-3xl p-6 border border-[#FCE7F3] shadow-sm relative overflow-hidden flex flex-col items-center text-center">
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-pink-100/60 rounded-full blur-2xl pointer-events-none" />

            {/* Avatar Container */}
            <div className="relative group mb-4">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full p-1 bg-gradient-to-tr from-[#F472B6] via-pink-300 to-[#FF85A1] shadow-lg shadow-pink-100">
                {avatarPreview || profile?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarPreview || profile?.avatarUrl || ''}
                    alt="Avatar"
                    className="w-full h-full object-cover rounded-full bg-white"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-[#F472B6] to-[#FFB6C1] flex items-center justify-center text-white text-2xl font-bold">
                    {profile?.displayName?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
              </div>

              {/* Camera Change Button Overlay */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-1 right-1 p-2.5 rounded-full bg-[#F472B6] hover:bg-[#EC4899] text-white shadow-md transition-all group-hover:scale-110 cursor-pointer"
                title="Đổi ảnh đại diện"
                aria-label="Đổi ảnh đại diện"
              >
                <Camera className="w-4 h-4" />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                className="hidden"
                id="avatar-upload"
              />
            </div>

            {/* Display Name & Email */}
            <h2 className="text-lg font-bold text-slate-800">
              {profile?.displayName || profile?.email?.split('@')[0] || 'User'}
            </h2>
            <p className="text-xs font-medium text-slate-500 mt-0.5">{profile?.email || 'Không có email'}</p>

            {/* Avatar Actions */}
            {selectedFile && (
              <div className="w-full mt-4 p-3 bg-[#FFF9FA] border border-[#FCE7F3] rounded-2xl">
                <p className="text-xs text-slate-600 mb-2">Ảnh đã chọn: {selectedFile.name}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAvatarUpload}
                    disabled={isUploadingAvatar}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-white bg-[#F472B6] rounded-lg hover:bg-[#EC4899] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploadingAvatar ? (
                      <>
                        <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Đang tải...
                      </>
                    ) : (
                      <>
                        <Upload size={14} />
                        Tải lên
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      if (avatarPreview && avatarPreview.startsWith('blob:')) {
                        URL.revokeObjectURL(avatarPreview);
                      }
                      setAvatarPreview(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    disabled={isUploadingAvatar}
                    className="px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}

            {profile?.avatarPath && !selectedFile && (
              <button
                type="button"
                onClick={handleAvatarRemove}
                disabled={isRemovingAvatar}
                className="mt-4 flex items-center gap-2 px-4 py-2 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRemovingAvatar ? (
                  <>
                    <span className="inline-block w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                    Đang xóa...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    Xóa ảnh đại diện
                  </>
                )}
              </button>
            )}

            {/* Account Created Date */}
            {profile?.createdAt && (
              <div className="w-full mt-6 pt-6 border-t border-[#FCE7F3]">
                <div className="bg-[#FFF9FA] p-3 rounded-2xl border border-[#FCE7F3]">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Ngày tham gia</span>
                  </div>
                  <p className="text-xs font-bold text-slate-700">
                    {new Date(profile.createdAt).toLocaleDateString('vi-VN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Forms (Profile Form + Security Form + Sessions) */}
        <div className="lg:col-span-2 space-y-8">

          {/* Section 1: Profile Information Form */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#FCE7F3] shadow-sm space-y-6">
            <div className="flex items-center gap-2.5 pb-4 border-b border-[#FCE7F3]">
              <div className="p-2 rounded-xl bg-[#FFF1F2] text-[#F472B6]">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-800">Thông Tin Cá Nhân</h3>
                <p className="text-xs text-slate-500">Cập nhật tên hiển thị và email tài khoản</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Display Name */}
              <div className="space-y-1.5">
                <label htmlFor="displayName" className="block text-xs font-bold text-slate-700">
                  Tên hiển thị <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={isLoadingProfile || isSavingProfile}
                    placeholder="Nhập tên hiển thị của bạn"
                    maxLength={80}
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-[#FFF9FA] border border-[#FCE7F3] text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F472B6] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Email (Read-only) */}
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-xs font-bold text-slate-700">
                  Email tài khoản
                </label>
                {isLoadingProfile ? (
                  <div className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl animate-pulse" />
                ) : (
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="email"
                      type="email"
                      value={profile?.email || ''}
                      disabled
                      className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-slate-50 border border-slate-200 text-slate-500 font-medium cursor-not-allowed"
                    />
                  </div>
                )}
              </div>

              {/* Profile Error Message */}
              {profileError && (
                <div
                  className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm"
                  role="alert"
                  aria-live="polite"
                >
                  {profileError}
                </div>
              )}

              {/* Profile Success Message */}
              {profileSuccess && (
                <div
                  className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-xl text-sm flex items-center gap-2"
                  role="status"
                  aria-live="polite"
                >
                  <CheckCircle2 size={16} />
                  <span>{profileSuccess}</span>
                </div>
              )}

              {/* Save Profile Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleProfileSave}
                  disabled={isSavingProfile || isLoadingProfile}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-[#F472B6] to-[#FF85A1] hover:opacity-95 text-white font-extrabold text-sm shadow-md shadow-pink-200 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSavingProfile ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Lưu Hồ Sơ</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Security & Password */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#FCE7F3] shadow-sm space-y-6">
            <div className="flex items-center gap-2.5 pb-4 border-b border-[#FCE7F3]">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-800">Bảo Mật Mật Khẩu</h3>
                <p className="text-xs text-slate-500">Đổi mật khẩu mới để bảo vệ tài khoản tốt hơn</p>
              </div>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

                {/* New Password */}
                <div className="space-y-1.5">
                  <label htmlFor="newPassword" className="block text-xs font-bold text-slate-700">
                    Mật khẩu mới
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      disabled={isSubmittingPassword}
                      placeholder="Tối thiểu 8 ký tự"
                      autoComplete="new-password"
                      className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl bg-[#FFF9FA] border border-[#FCE7F3] text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F472B6] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      disabled={isSubmittingPassword}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-50"
                      aria-label={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <label htmlFor="confirmPassword" className="block text-xs font-bold text-slate-700">
                    Xác nhận mật khẩu
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={isSubmittingPassword}
                      placeholder="Nhập lại mật khẩu mới"
                      autoComplete="new-password"
                      className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl bg-[#FFF9FA] border border-[#FCE7F3] text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F472B6] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={isSubmittingPassword}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-50"
                      aria-label={showConfirmPassword ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Password Error */}
              {passwordError && (
                <div
                  className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm"
                  role="alert"
                  aria-live="polite"
                >
                  {passwordError}
                </div>
              )}

              {/* Password Success */}
              {passwordSuccess && (
                <div
                  className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-xl text-sm flex items-center gap-2"
                  role="status"
                  aria-live="polite"
                >
                  <CheckCircle2 size={16} />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isSubmittingPassword}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-sm shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingPassword ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Đang cập nhật...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Đổi Mật Khẩu</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Section 3: Sessions & Logout */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#FCE7F3] shadow-sm space-y-6">
            <div className="flex items-center gap-2.5 pb-4 border-b border-[#FCE7F3]">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-800">Phiên Đăng Nhập</h3>
                <p className="text-xs text-slate-500">Quản lý phiên đăng nhập của bạn</p>
              </div>
            </div>

            {/* Session Info */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700">Phiên đăng nhập hiện tại</p>
              <p className="text-sm text-slate-500">Bạn đang đăng nhập trên thiết bị này.</p>
            </div>

            {/* Logout Action */}
            <div className="pt-4 border-t border-[#FCE7F3] flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-700">Đăng xuất khỏi thiết bị</p>
                <p className="text-[11px] text-slate-500">Kết thúc phiên làm việc hiện tại trên trình duyệt này</p>
              </div>

              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-extrabold text-sm border border-rose-200 transition-all cursor-pointer shadow-2xs"
              >
                <LogOut className="w-4 h-4" />
                <span>Đăng Xuất</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowLogoutConfirm(false);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setShowLogoutConfirm(false);
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-title"
        >
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full border border-[#FCE7F3] shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <LogOut className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 id="logout-title" className="text-lg font-bold text-slate-800">Xác nhận Đăng Xuất</h3>
              <p className="text-xs text-slate-500">
                Bạn có chắc chắn muốn đăng xuất khỏi tài khoản <strong className="text-slate-800">{profile?.email}</strong> không?
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <SignOutButton className="flex-1 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-rose-200 justify-center" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
