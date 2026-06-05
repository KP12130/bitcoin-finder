'use client';

import { useState, useCallback, useEffect } from 'react';
import { getProfile, setProfile as saveProfile } from '@/lib/storage';
import { supabase, isDbEnabled } from '@/lib/supabase';

export function useProfile() {
  const [profile, setProfileState] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(null);

  // Auth session listener
  useEffect(() => {
    setMounted(true);
    setProfileState(getProfile());

    if (isDbEnabled()) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user || null);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user || null);
      });

      return () => subscription.unsubscribe();
    }
  }, []);

  // Fetch profile from DB if authenticated
  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('username, avatar, vip_points')
          .eq('id', user.id)
          .single();
        if (data) {
          const profileData = {
            username: data.username,
            avatar: data.avatar || 'miner',
            vipPoints: Number(data.vip_points),
          };
          setProfileState(profileData);
          saveProfile(profileData);
        }
      };
      fetchProfile();
    }
  }, [user]);

  const updateProfile = useCallback(async (updates) => {
    const current = getProfile();
    const updated = { ...current, ...updates };
    saveProfile(updated);
    setProfileState(updated);

    if (isDbEnabled() && user) {
      const dbUpdates = {};
      if (updates.username !== undefined) dbUpdates.username = updates.username;
      if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
      
      if (Object.keys(dbUpdates).length > 0) {
        await supabase
          .from('profiles')
          .update(dbUpdates)
          .eq('id', user.id);
      }
    }
  }, [user]);

  return { profile, updateProfile, mounted, user };
}
