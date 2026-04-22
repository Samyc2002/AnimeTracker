'use client';

import { useEffect, useState } from 'react';
import { Query, ID } from 'appwrite';
import { account, databases, DATABASE_ID, PROFILES_COLLECTION_ID } from '@/lib/appwrite';

export default function SettingsPage() {
  const [language, setLanguage] = useState('English');
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState('');
  const [profileDocId, setProfileDocId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const user = await account.get();
      setEmail(user.email);

      const profiles = await databases.listDocuments(DATABASE_ID, PROFILES_COLLECTION_ID, [
        Query.equal('user_id', user.$id),
        Query.limit(1),
      ]);

      if (profiles.documents.length > 0) {
        const profile = profiles.documents[0] as unknown as { $id: string; display_language: string };
        setLanguage(profile.display_language);
        setProfileDocId(profile.$id);
      } else {
        const newProfile = await databases.createDocument(DATABASE_ID, PROFILES_COLLECTION_ID, ID.unique(), {
          user_id: user.$id,
          display_language: 'English',
        });
        setProfileDocId(newProfile.$id);
      }
    }
    load();
  }, []);

  async function saveLanguage(value: string) {
    setLanguage(value);
    if (!profileDocId) return;
    setSaving(true);
    await databases.updateDocument(DATABASE_ID, PROFILES_COLLECTION_ID, profileDocId, {
      display_language: value,
    });
    setSaving(false);
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-200 mb-6">Settings</h1>

      <div className="space-y-6 max-w-md">
        <div>
          <p className="text-sm text-gray-400 mb-1">Signed in as</p>
          <p className="text-gray-200">{email}</p>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-gray-300">Title language</label>
          <select
            value={language}
            onChange={(e) => saveLanguage(e.target.value)}
            className="px-3 py-1.5 bg-[#0b0e14] border border-[#253040] rounded-lg text-gray-200 text-sm"
          >
            <option value="English">English</option>
            <option value="Japanese">Japanese</option>
          </select>
        </div>

        {saving && <p className="text-xs text-gray-500">Saving...</p>}
      </div>
    </div>
  );
}
