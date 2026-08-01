'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { User, Lock, Eye, EyeOff, CheckCircle2, Mail, Upload, Trash2, Calendar } from 'lucide-react';
import { SignOutButton } from './auth/sign-out-button';
import { updateAccountPassword } from '@/services/accountService';
import { validatePasswordMatch } from '@/lib/validation/password';
import { PasswordUpdateError } from '@/services/accountErrors';
import { getCurrentProfile, updateDisplayName, uploadAvatar, removeAvatar } from '@/services/profileService';
import { ProfileServiceError, AvatarUploadError, DisplayNameValidationError } from '@/services/profileErrors';
import type { UserProfile } from '@/services/profileService';

interface AccountSettingsProps {
  onClose: () => void;
}

export function AccountSettings({ onClose }: AccountSettingsProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // Profile form
  const [displayName, setDisplayName] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // Password change form
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Cho phép render Portal sau khi component đã mount trên browser
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);

    return () => {
      setIsMounted(false);
    };
  }, []);

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

      setProfileSuccess('Ảnh đại diện đã được cập nhật.');
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

  const handleAvatarRemove = async () => {
    if (isRemovingAvatar || !profile?.avatarPath) return;

    setProfileError(null);
    setProfileSuccess(null);
    setIsRemovingAvatar(true);

    try {
      const updatedProfile = await removeAvatar();
      setProfile(updatedProfile);
      setProfileSuccess('Ảnh đại diện đã được xóa.');
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
        setProfileSuccess('Hồ sơ đã được cập nhật.');
      } else if (!selectedFile) {
        setProfileSuccess('Không có thay đổi nào.');
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

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="my-auto w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-[#FCE7F3] bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 z-10 rounded-t-3xl border-b border-[#FCE7F3] bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F472B6] to-[#FFB6C1] p-0.5 shadow-md shadow-pink-100">
                <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
                  <User className="w-5 h-5 text-[#F472B6]" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-[#4A4A4A]">Tài khoản</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              aria-label="Đóng"
            >
              <span className="text-2xl leading-none">&times;</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Profile Section */}
          <section>
            <h3 className="text-sm font-semibold text-[#4A4A4A] mb-3">Hồ sơ cá nhân</h3>
            <div className="space-y-4">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                {/* Avatar Display */}
                <div className="relative">
                  {avatarPreview || profile?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarPreview || profile?.avatarUrl || ''}
                      alt="Avatar"
                      className="w-20 h-20 rounded-full object-cover border-2 border-[#FCE7F3]"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#F472B6] to-[#FFB6C1] flex items-center justify-center text-white text-2xl font-bold border-2 border-[#FCE7F3]">
                      {profile?.displayName?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                </div>

                {/* Avatar Actions */}
                <div className="flex-1 space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="avatar-upload"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingAvatar || isRemovingAvatar || isSavingProfile}
                      className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#F472B6] bg-[#FFF9FA] border border-[#FCE7F3] rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Upload size={14} />
                      Chọn ảnh
                    </button>
                    {profile?.avatarPath && (
                      <button
                        type="button"
                        onClick={handleAvatarRemove}
                        disabled={isUploadingAvatar || isRemovingAvatar || isSavingProfile}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isRemovingAvatar ? (
                          <>
                            <span className="inline-block w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                            Đang xóa...
                          </>
                        ) : (
                          <>
                            <Trash2 size={14} />
                            Xóa ảnh
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-[#9CA3AF]">JPG, PNG hoặc WebP. Tối đa 2 MB.</p>
                </div>
              </div>

              {/* Display Name */}
              <div>
                <label htmlFor="displayName" className="block text-sm font-medium text-[#4A4A4A] mb-2">
                  Tên hiển thị
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={isLoadingProfile || isSavingProfile}
                  className="w-full px-4 py-2.5 bg-[#FFF9FA] border border-[#FCE7F3] rounded-xl text-sm text-[#4A4A4A] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#F472B6] focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Nhập tên của bạn"
                  maxLength={80}
                />
              </div>

              {/* Email (read-only) */}
              <div className="bg-[#FFF9FA] border border-[#FCE7F3] rounded-xl p-4">
                {isLoadingProfile ? (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-gray-200 rounded animate-pulse w-32" />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F472B6] to-[#FFB6C1] flex items-center justify-center">
                      <Mail className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-[#9CA3AF] font-medium">Email tài khoản</p>
                      <p className="text-sm font-medium text-[#4A4A4A]">
                        {profile?.email || 'Không có email'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Account Created Date */}
              {profile?.createdAt && (
                <div className="bg-[#FFF9FA] border border-[#FCE7F3] rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F472B6] to-[#FFB6C1] flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-[#9CA3AF] font-medium">Ngày tạo tài khoản</p>
                      <p className="text-sm font-medium text-[#4A4A4A]">
                        {new Date(profile.createdAt).toLocaleDateString('vi-VN', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              )}

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
              <button
                type="button"
                onClick={handleProfileSave}
                disabled={isSavingProfile || isLoadingProfile}
                className="w-full bg-gradient-to-r from-[#F472B6] to-[#FF85A1] text-white font-medium py-2.5 px-4 rounded-xl hover:shadow-md hover:shadow-pink-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none flex items-center justify-center gap-2 text-sm"
              >
                {isSavingProfile ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <User size={16} />
                    <span>Lưu hồ sơ</span>
                  </>
                )}
              </button>
            </div>
          </section>

          {/* Security Section */}
          <section>
            <h3 className="text-sm font-semibold text-[#4A4A4A] mb-3">Bảo mật</h3>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              {/* New Password Field */}
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-[#4A4A4A] mb-2">
                  Mật khẩu mới
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                  <input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={isSubmittingPassword}
                    className="w-full pl-10 pr-11 py-2.5 bg-[#FFF9FA] border border-[#FCE7F3] rounded-xl text-sm text-[#4A4A4A] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#F472B6] focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Tối thiểu 8 ký tự"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    disabled={isSubmittingPassword}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#F472B6] transition-colors disabled:opacity-50"
                    aria-label={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Field */}
              <div>
                <label htmlFor="confirmPasswordSettings" className="block text-sm font-medium text-[#4A4A4A] mb-2">
                  Xác nhận mật khẩu
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                  <input
                    id="confirmPasswordSettings"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isSubmittingPassword}
                    className="w-full pl-10 pr-11 py-2.5 bg-[#FFF9FA] border border-[#FCE7F3] rounded-xl text-sm text-[#4A4A4A] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#F472B6] focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Nhập lại mật khẩu mới"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={isSubmittingPassword}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#F472B6] transition-colors disabled:opacity-50"
                    aria-label={showConfirmPassword ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {passwordError && (
                <div
                  className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm"
                  role="alert"
                  aria-live="polite"
                >
                  {passwordError}
                </div>
              )}

              {/* Success Message */}
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
              <button
                type="submit"
                disabled={isSubmittingPassword}
                className="w-full bg-gradient-to-r from-[#F472B6] to-[#FF85A1] text-white font-medium py-2.5 px-4 rounded-xl hover:shadow-md hover:shadow-pink-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none flex items-center justify-center gap-2 text-sm"
              >
                {isSubmittingPassword ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang cập nhật...</span>
                  </>
                ) : (
                  <>
                    <Lock size={16} />
                    <span>Đổi mật khẩu</span>
                  </>
                )}
              </button>
            </form>
          </section>

          {/* Sign Out Section */}
          <section>
            <h3 className="text-sm font-semibold text-[#4A4A4A] mb-3">Phiên đăng nhập</h3>
            <SignOutButton className="w-full justify-center" />
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
}
