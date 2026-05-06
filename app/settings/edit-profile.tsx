import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts, borderRadius } from '../../src/constants/theme';
import { fetchUserProfile, updateUserProfile, uploadAvatar } from '../../src/lib/api';
import { useAuth } from '../../src/providers/AuthProvider';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user: authUser, setUser } = useAuth();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchUserProfile()
      .then((profile) => {
        if (profile) {
          const u = profile.user;
          setName(u.name ?? '');
          setUsername(u.username ?? '');
          setBio(u.bio ?? '');
          setImageUrl(u.image ?? authUser?.image ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    else if (name.trim().length > 50) errs.name = 'Name must be 50 characters or less';
    if (username.trim().length > 0) {
      if (username.trim().length < 3 || username.trim().length > 20) {
        errs.username = 'Username must be 3-20 characters';
      } else if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
        errs.username = 'Letters, numbers, and underscores only';
      }
    }
    if (bio.length > 160) errs.bio = 'Bio must be 160 characters or less';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setErrors({});
    try {
      await updateUserProfile({
        name: name.trim(),
        username: username.trim() || undefined,
        bio: bio.trim() || undefined,
      });
      setSuccess(true);
      setTimeout(() => router.back(), 800);
    } catch (e: any) {
      if (e.status === 409) {
        setErrors({ username: 'Username already taken' });
      } else {
        setErrors({ general: e.message || 'Something went wrong' });
      }
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async (source: 'camera' | 'library') => {
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera access is required to take a photo.');
        return;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Photo library access is required to choose a photo.');
        return;
      }
    }

    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    };

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];

    if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE) {
      Alert.alert('File too large', 'Please choose an image under 2 MB.');
      return;
    }

    const previousUrl = imageUrl;
    setImageUrl(asset.uri);
    setUploadingAvatar(true);

    try {
      const { url } = await uploadAvatar(asset.uri);
      setImageUrl(url);
      if (authUser) {
        const updated = { ...authUser, image: url };
        setUser(updated);
        await SecureStore.setItemAsync('auth_user', JSON.stringify(updated));
      }
    } catch {
      setImageUrl(previousUrl);
      setErrors({ avatar: 'Failed to upload photo' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const showImageOptions = () => {
    Alert.alert('Profile photo', '', [
      { text: 'Take Photo', onPress: () => pickImage('camera') },
      { text: 'Choose from Library', onPress: () => pickImage('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const initial = (name || authUser?.name || 'U').charAt(0).toUpperCase();

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={colors.ivory} strokeWidth={2} />
            </Svg>
          </Pressable>
          <Text style={styles.title}>Edit profile</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={colors.ivory} strokeWidth={2} />
          </Svg>
        </Pressable>
        <Text style={styles.title}>Edit profile</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <Pressable onPress={showImageOptions} style={styles.avatarWrap}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
            )}
            {uploadingAvatar && (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color="#fff" size="small" />
              </View>
            )}
            <View style={styles.cameraBadge}>
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"
                  stroke="#fff"
                  strokeWidth={2}
                />
                <Circle cx={12} cy={13} r={4} stroke="#fff" strokeWidth={2} />
              </Svg>
            </View>
          </Pressable>
          <Text style={styles.avatarHint}>Tap to change photo</Text>
          {!!errors.avatar && <Text style={styles.error}>{errors.avatar}</Text>}
        </View>

        {/* Name */}
        <Text style={styles.label}>NAME</Text>
        <TextInput
          value={name}
          onChangeText={(t) => { setName(t); setErrors((e) => ({ ...e, name: '' })); }}
          maxLength={50}
          style={[styles.input, errors.name ? styles.inputError : null]}
          placeholderTextColor="rgba(245,240,225,0.2)"
          placeholder="Your name"
        />
        {!!errors.name && <Text style={styles.error}>{errors.name}</Text>}

        {/* Username */}
        <Text style={styles.label}>USERNAME</Text>
        <TextInput
          value={username}
          onChangeText={(t) => { setUsername(t); setErrors((e) => ({ ...e, username: '' })); }}
          maxLength={20}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, errors.username ? styles.inputError : null]}
          placeholderTextColor="rgba(245,240,225,0.2)"
          placeholder="username"
        />
        {!!errors.username && <Text style={styles.error}>{errors.username}</Text>}

        {/* Bio */}
        <View style={styles.labelRow}>
          <Text style={styles.label}>BIO</Text>
          <Text style={styles.charCount}>{bio.length}/160</Text>
        </View>
        <TextInput
          value={bio}
          onChangeText={(t) => { setBio(t); setErrors((e) => ({ ...e, bio: '' })); }}
          maxLength={160}
          multiline
          numberOfLines={4}
          style={[styles.input, styles.bioInput, errors.bio ? styles.inputError : null]}
          placeholderTextColor="rgba(245,240,225,0.2)"
          placeholder="Tell us about yourself"
          textAlignVertical="top"
        />
        {!!errors.bio && <Text style={styles.error}>{errors.bio}</Text>}

        {!!errors.general && <Text style={[styles.error, { marginTop: 12 }]}>{errors.general}</Text>}

        {success && <Text style={styles.successText}>Profile updated</Text>}

        {/* Save button */}
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        >
          {saving ? (
            <ActivityIndicator color={colors.background} size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Save changes</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginTop: 12,
    marginBottom: 20,
  },
  backBtn: { width: 32, height: 32, justifyContent: 'center' },
  title: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.ivory,
    textAlign: 'center',
    marginRight: -32,
    letterSpacing: -0.2,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 16 },

  // Avatar
  avatarSection: {
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    position: 'relative',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarFallback: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontFamily: fonts.bodyBold,
    fontSize: 28,
    color: colors.background,
    letterSpacing: -0.6,
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2DD4A8',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  avatarHint: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: 'rgba(245,240,225,0.35)',
    marginTop: 8,
  },

  // Form
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: 'rgba(245,240,225,0.5)',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCount: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: 'rgba(245,240,225,0.3)',
    marginTop: 16,
  },
  input: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ivory,
    backgroundColor: 'rgba(245,240,225,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.15)',
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bioInput: {
    minHeight: 80,
    paddingTop: 10,
  },
  inputError: {
    borderColor: '#E24B4A',
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#E24B4A',
    marginTop: 4,
  },
  successText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: '#2DD4A8',
    textAlign: 'center',
    marginTop: 16,
  },
  saveBtn: {
    backgroundColor: colors.gold,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 28,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.background,
  },
});
