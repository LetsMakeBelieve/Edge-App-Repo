import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { hasSupabaseConfig, supabase } from './src/lib/supabase';

const COMPANY_EMAIL_DOMAIN = 'edgetechnologies.com';
const COMPANY_EMAIL_LOCAL_PATTERN = /^[a-z][a-z]+$/;
const FRACTION_OPTIONS = [
  { eighths: 0, label: '0' },
  { eighths: 1, label: '1/8' },
  { eighths: 2, label: '1/4' },
  { eighths: 3, label: '3/8' },
  { eighths: 4, label: '1/2' },
  { eighths: 5, label: '5/8' },
  { eighths: 6, label: '3/4' },
  { eighths: 7, label: '7/8' },
];
const BAR_FEEDER_MANUFACTURERS = ['Edge Technologies', 'FMB'];
const RECENT_LOOKUPS_KEY = 'barfeederdistanceapp:recent-lookups';
const THEME_MODE_KEY = 'barfeederdistanceapp:theme-mode';

const lightTheme = {
  accent: '#2563eb',
  accentMuted: '#eff6ff',
  background: '#f8fafc',
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  buttonDisabled: '#94a3b8',
  danger: '#991b1b',
  dangerText: '#7f1d1d',
  field: '#f8fafc',
  muted: '#64748b',
  panel: '#ffffff',
  panelAlt: '#f8fafc',
  placeholder: '#64748b',
  positive: '#047857',
  segmentTrack: '#e2e8f0',
  separator: '#f1f5f9',
  text: '#0f172a',
  textAlt: '#111827',
  textSoft: '#334155',
  textSubtle: '#475569',
  white: '#ffffff',
};

const darkTheme = {
  accent: '#60a5fa',
  accentMuted: '#172554',
  background: '#0f172a',
  border: '#334155',
  borderStrong: '#475569',
  buttonDisabled: '#475569',
  danger: '#fca5a5',
  dangerText: '#fecaca',
  field: '#111827',
  muted: '#94a3b8',
  panel: '#1e293b',
  panelAlt: '#111827',
  placeholder: '#94a3b8',
  positive: '#34d399',
  segmentTrack: '#0f172a',
  separator: '#334155',
  text: '#f8fafc',
  textAlt: '#f8fafc',
  textSoft: '#cbd5e1',
  textSubtle: '#cbd5e1',
  white: '#ffffff',
};

function capitalizeNamePart(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function parseCompanyEmail(rawEmail) {
  const normalizedEmail = rawEmail.trim().toLowerCase();
  const [localPart, domain, extraPart] = normalizedEmail.split('@');

  if (!localPart || !domain || extraPart || domain !== COMPANY_EMAIL_DOMAIN) {
    return {
      error: `Use your @${COMPANY_EMAIL_DOMAIN} email address.`,
    };
  }

  if (!COMPANY_EMAIL_LOCAL_PATTERN.test(localPart)) {
    return {
      error: 'Use the company format: first initial plus last name, like jdoe.',
    };
  }

  const firstInitial = localPart.charAt(0).toUpperCase();
  const lastName = capitalizeNamePart(localPart.slice(1));

  return {
    displayName: `${firstInitial}. ${lastName}`,
    email: normalizedEmail,
    localPart,
  };
}

export default function App() {
  const [session, setSession] = useState(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [lathes, setLathes] = useState([]);
  const [barFeeders, setBarFeeders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedLatheId, setSelectedLatheId] = useState(null);
  const [selectedBarFeederId, setSelectedBarFeederId] = useState(null);
  const [distanceRecord, setDistanceRecord] = useState(null);
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [lookupMessage, setLookupMessage] = useState('');
  const [measuredWholeInches, setMeasuredWholeInches] = useState('');
  const [measuredFractionEighths, setMeasuredFractionEighths] = useState(0);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [submissionMessage, setSubmissionMessage] = useState('');
  const [isSavingSubmission, setIsSavingSubmission] = useState(false);
  const [variationWholeInches, setVariationWholeInches] = useState('');
  const [variationFractionEighths, setVariationFractionEighths] = useState(0);
  const [variationReason, setVariationReason] = useState('');
  const [variationMessage, setVariationMessage] = useState('');
  const [isSavingVariation, setIsSavingVariation] = useState(false);
  const [newLatheName, setNewLatheName] = useState('');
  const [newLatheManufacturer, setNewLatheManufacturer] = useState('');
  const [newBarFeederName, setNewBarFeederName] = useState('');
  const [newBarFeederManufacturer, setNewBarFeederManufacturer] = useState(
    BAR_FEEDER_MANUFACTURERS[0]
  );
  const [latheMessage, setLatheMessage] = useState('');
  const [barFeederMessage, setBarFeederMessage] = useState('');
  const [isSavingLathe, setIsSavingLathe] = useState(false);
  const [isSavingBarFeeder, setIsSavingBarFeeder] = useState(false);
  const [recentLookups, setRecentLookups] = useState([]);
  const [themeMode, setThemeMode] = useState('light');
  const isDarkMode = themeMode === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;
  styles = createStyles(theme);
  const textInputProps = getTextInputThemeProps(theme);

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setIsCheckingSession(false);
      return undefined;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsCheckingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        setAuthMessage('');
        setPassword('');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadEquipment = useCallback(async () => {
    if (!hasSupabaseConfig) {
      setErrorMessage('Add your Supabase URL and anon key to a .env file.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    const [lathesResult, barFeedersResult] = await Promise.all([
      supabase
        .from('lathes')
        .select('id, name, manufacturer, created_at')
        .order('manufacturer')
        .order('name'),
      supabase
        .from('bar_feeders')
        .select('id, name, manufacturer, created_at')
        .order('manufacturer')
        .order('name'),
    ]);

    if (lathesResult.error || barFeedersResult.error) {
      setErrorMessage(
        lathesResult.error?.message ||
          barFeedersResult.error?.message ||
          'Unable to load equipment.'
      );
      setIsLoading(false);
      return;
    }

    setLathes(lathesResult.data ?? []);
    setBarFeeders(barFeedersResult.data ?? []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (session) {
      loadEquipment();
    }
  }, [loadEquipment, session]);

  useEffect(() => {
    AsyncStorage.getItem(RECENT_LOOKUPS_KEY)
      .then((storedLookups) => {
        if (storedLookups) {
          setRecentLookups(JSON.parse(storedLookups));
        }
      })
      .catch(() => {
        setRecentLookups([]);
      });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(THEME_MODE_KEY)
      .then((storedThemeMode) => {
        if (storedThemeMode === 'dark' || storedThemeMode === 'light') {
          setThemeMode(storedThemeMode);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const loadDistance = async () => {
      if (!session || !selectedLatheId || !selectedBarFeederId) {
        setDistanceRecord(null);
        setLookupMessage('');
        return;
      }

      setDistanceRecord(null);
      setLookupMessage('');
      setSubmissionMessage('');
      setVariationMessage('');
      setMeasuredWholeInches('');
      setMeasuredFractionEighths(0);
      setSubmissionNotes('');
      setVariationWholeInches('');
      setVariationFractionEighths(0);
      setVariationReason('');
      setIsLookupLoading(true);

      const { data, error } = await supabase
        .from('distances')
        .select('*')
        .eq('lathe_id', selectedLatheId)
        .eq('bar_feeder_id', selectedBarFeederId)
        .maybeSingle();

      setIsLookupLoading(false);

      if (error) {
        setLookupMessage(error.message);
        return;
      }

      setDistanceRecord(data);
    };

    loadDistance();
  }, [selectedBarFeederId, selectedLatheId, session]);

  useEffect(() => {
    if (!distanceRecord || !selectedLathe || !selectedBarFeeder) {
      return;
    }

    const distanceInEighths = getDistanceRecordEighths(distanceRecord);
    const nextLookup = {
      bar_feeder_id: selectedBarFeeder.id,
      bar_feeder_manufacturer: selectedBarFeeder.manufacturer,
      bar_feeder_name: selectedBarFeeder.name,
      distance_display: formatEighthsAsInches(distanceInEighths),
      distance_in_eighths: distanceInEighths,
      lathe_id: selectedLathe.id,
      lathe_manufacturer: selectedLathe.manufacturer,
      lathe_name: selectedLathe.name,
      lookup_key: `${selectedLathe.id}:${selectedBarFeeder.id}`,
      viewed_at: new Date().toISOString(),
    };

    setRecentLookups((currentLookups) => {
      const nextLookups = [
        nextLookup,
        ...currentLookups.filter(
          (lookup) => lookup.lookup_key !== nextLookup.lookup_key
        ),
      ].slice(0, 5);

      AsyncStorage.setItem(RECENT_LOOKUPS_KEY, JSON.stringify(nextLookups)).catch(
        () => {}
      );

      return nextLookups;
    });
  }, [distanceRecord, selectedBarFeeder, selectedLathe]);

  const validateCompanyCredentials = () => {
    if (!hasSupabaseConfig) {
      setAuthMessage('Add your Supabase URL and anon key to a .env file.');
      return null;
    }

    const parsedEmail = parseCompanyEmail(email);

    if (parsedEmail.error) {
      setAuthMessage(parsedEmail.error);
      return null;
    }

    if (password.length < 6) {
      setAuthMessage('Password must be at least 6 characters.');
      return null;
    }

    return parsedEmail;
  };

  const signIn = async () => {
    const companyCredentials = validateCompanyCredentials();

    if (!companyCredentials) {
      return;
    }

    setIsAuthLoading(true);
    setAuthMessage('');

    const { error } = await supabase.auth.signInWithPassword({
      email: companyCredentials.email,
      password,
    });

    setIsAuthLoading(false);

    if (error) {
      setAuthMessage(error.message);
    }
  };

  const createAccount = async () => {
    const companyCredentials = validateCompanyCredentials();

    if (!companyCredentials) {
      return;
    }

    setIsAuthLoading(true);
    setAuthMessage('');

    const { data, error } = await supabase.auth.signUp({
      email: companyCredentials.email,
      password,
      options: {
        data: {
          company_email_domain: COMPANY_EMAIL_DOMAIN,
          company_email_local_part: companyCredentials.localPart,
          display_name: companyCredentials.displayName,
          full_name: companyCredentials.displayName,
        },
      },
    });

    setIsAuthLoading(false);

    if (error) {
      setAuthMessage(error.message);
      return;
    }

    if (!data.session) {
      setAuthMessage('Account created. Check your email to confirm it, then sign in.');
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setLathes([]);
    setBarFeeders([]);
    setSelectedLatheId(null);
    setSelectedBarFeederId(null);
    setDistanceRecord(null);
  };

  const selectedLathe = lathes.find((lathe) => lathe.id === selectedLatheId);
  const selectedBarFeeder = barFeeders.find(
    (barFeeder) => barFeeder.id === selectedBarFeederId
  );
  const hasSelection = Boolean(selectedLathe && selectedBarFeeder);

  const toggleThemeMode = () => {
    setThemeMode((currentMode) => {
      const nextMode = currentMode === 'dark' ? 'light' : 'dark';

      AsyncStorage.setItem(THEME_MODE_KEY, nextMode).catch(() => {});

      return nextMode;
    });
  };

  const saveMeasuredDistance = async () => {
    if (!selectedLathe || !selectedBarFeeder) {
      setSubmissionMessage('Select a lathe and bar feeder first.');
      return;
    }

    const distanceInEighths = getDistanceSelectionEighths(
      measuredWholeInches,
      measuredFractionEighths
    );

    if (!distanceInEighths) {
      setSubmissionMessage('Enter the measured distance in inches.');
      return;
    }

    const distanceMm = eighthsToMillimeters(distanceInEighths);

    setIsSavingSubmission(true);
    setSubmissionMessage('');

    const { error } = await supabase.from('user_submissions').insert({
      user_id: session.user.id,
      lathe_name: selectedLathe.name,
      bar_feeder_name: selectedBarFeeder.name,
      distance_in_eighths: distanceInEighths,
      distance_mm: distanceMm,
      notes: submissionNotes.trim() || null,
    });

    setIsSavingSubmission(false);

    if (error) {
      setSubmissionMessage(error.message);
      return;
    }

    setMeasuredWholeInches('');
    setMeasuredFractionEighths(0);
    setSubmissionNotes('');
    setSubmissionMessage('Measurement submitted for review.');
  };

  const saveVariation = async () => {
    if (!distanceRecord) {
      setVariationMessage('Select a saved distance before adding a variation.');
      return;
    }

    const variationInEighths = getDistanceSelectionEighths(
      variationWholeInches,
      variationFractionEighths
    );

    if (!variationInEighths) {
      setVariationMessage('Enter the measurement used in inches.');
      return;
    }

    if (!variationReason.trim()) {
      setVariationMessage('Explain why the variation was needed.');
      return;
    }

    setIsSavingVariation(true);
    setVariationMessage('');

    const { error } = await supabase.from('variations').insert({
      user_id: session.user.id,
      distance_id: distanceRecord.id,
      variation_distance_in_eighths: variationInEighths,
      variation_distance_mm: eighthsToMillimeters(variationInEighths),
      reason: variationReason.trim(),
    });

    setIsSavingVariation(false);

    if (error) {
      setVariationMessage(error.message);
      return;
    }

    setVariationWholeInches('');
    setVariationFractionEighths(0);
    setVariationReason('');
    setVariationMessage('Variation saved.');
  };

  const addLatheModel = async () => {
    const modelName = newLatheName.trim();
    const manufacturer = newLatheManufacturer.trim();

    if (!modelName) {
      setLatheMessage('Enter a lathe model name.');
      return;
    }

    if (!manufacturer) {
      setLatheMessage('Enter a lathe manufacturer.');
      return;
    }

    setIsSavingLathe(true);
    setLatheMessage('');

    const { data, error } = await supabase
      .from('lathes')
      .insert({ manufacturer, name: modelName })
      .select('id, name, manufacturer, created_at')
      .single();

    setIsSavingLathe(false);

    if (error) {
      setLatheMessage(error.message);
      return;
    }

    setLathes((currentLathes) =>
      [...currentLathes, data].sort((left, right) =>
        formatModelSortName(left).localeCompare(formatModelSortName(right))
      )
    );
    setSelectedLatheId(data.id);
    setNewLatheName('');
    setNewLatheManufacturer('');
    setLatheMessage('Lathe model added.');
  };

  const addBarFeederModel = async () => {
    const modelName = newBarFeederName.trim();
    const manufacturer = newBarFeederManufacturer;

    if (!modelName) {
      setBarFeederMessage('Enter a bar feeder model name.');
      return;
    }

    setIsSavingBarFeeder(true);
    setBarFeederMessage('');

    const { data, error } = await supabase
      .from('bar_feeders')
      .insert({ manufacturer, name: modelName })
      .select('id, name, manufacturer, created_at')
      .single();

    setIsSavingBarFeeder(false);

    if (error) {
      setBarFeederMessage(error.message);
      return;
    }

    setBarFeeders((currentBarFeeders) =>
      [...currentBarFeeders, data].sort((left, right) =>
        formatModelSortName(left).localeCompare(formatModelSortName(right))
      )
    );
    setSelectedBarFeederId(data.id);
    setNewBarFeederName('');
    setBarFeederMessage('Bar feeder model added.');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerTitleBlock}>
            <Text style={styles.eyebrow}>Edge Technologies</Text>
            <Text style={styles.title}>Bar Feeder Distance</Text>
          </View>
          <Pressable style={styles.themeToggle} onPress={toggleThemeMode}>
            <Text style={styles.themeToggleText}>{isDarkMode ? 'Light' : 'Dark'}</Text>
          </Pressable>
        </View>
        <Text style={styles.subtitle}>Lathe setup distance lookup</Text>
      </View>

      {isCheckingSession ? (
        <View style={styles.centerPanel}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.mutedText}>Checking sign in...</Text>
        </View>
      ) : !session ? (
        <AuthPanel
          authMessage={authMessage}
          email={email}
          isAuthLoading={isAuthLoading}
          onCreateAccount={createAccount}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onSignIn={signIn}
          password={password}
          textInputProps={textInputProps}
        />
      ) : isLoading ? (
        <View style={styles.centerPanel}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.mutedText}>Loading equipment...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centerPanel}>
          <Text style={styles.errorTitle}>Connection needs setup</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable style={styles.button} onPress={loadEquipment}>
            <Text style={styles.buttonText}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView style={styles.contentScroll} contentContainerStyle={styles.content}>
          <View style={styles.signedInBar}>
            <View style={styles.signedInInfo}>
              <Text style={styles.signedInLabel}>Signed in</Text>
              <Text style={styles.signedInName}>{getSessionDisplayName(session)}</Text>
              <Text style={styles.signedInEmail}>{session.user.email}</Text>
            </View>
            <Pressable style={styles.secondaryButton} onPress={signOut}>
              <Text style={styles.secondaryButtonText}>Sign Out</Text>
            </Pressable>
          </View>

          <LatheSelector
            data={lathes}
            emptyMessage="No lathe models found."
            manufacturerInputLabel="Lathe Manufacturer"
            manufacturerInputValue={newLatheManufacturer}
            inputLabel="New Lathe Model"
            inputValue={newLatheName}
            isSaving={isSavingLathe}
            message={latheMessage}
            onAdd={addLatheModel}
            onInputChange={setNewLatheName}
            onManufacturerInputChange={setNewLatheManufacturer}
            onSelect={setSelectedLatheId}
            manufacturerPlaceholder="Example: Mazak"
            placeholder="Example: Mazak QTN-250"
            selectedId={selectedLatheId}
            submitLabel="Add Lathe"
            textInputProps={textInputProps}
            title="Select Lathe Model"
          />

          <BarFeederSelector
            data={barFeeders}
            emptyMessage="No bar feeder models found."
            manufacturerInputValue={newBarFeederManufacturer}
            inputLabel="New Bar Feeder Model"
            inputValue={newBarFeederName}
            isSaving={isSavingBarFeeder}
            message={barFeederMessage}
            onAdd={addBarFeederModel}
            onInputChange={setNewBarFeederName}
            onManufacturerInputChange={setNewBarFeederManufacturer}
            onSelect={setSelectedBarFeederId}
            placeholder="Example: Edge Rebel 80"
            selectedId={selectedBarFeederId}
            submitLabel="Add Bar Feeder"
            textInputProps={textInputProps}
            title="Select Bar Feeder Model"
          />

          <RecentLookups
            lookups={recentLookups}
            onSelect={(lookup) => {
              setSelectedLatheId(lookup.lathe_id);
              setSelectedBarFeederId(lookup.bar_feeder_id);
            }}
          />

          <DistanceResult
            distanceRecord={distanceRecord}
            hasSelection={hasSelection}
            isLookupLoading={isLookupLoading}
            lookupMessage={lookupMessage}
            measuredFractionEighths={measuredFractionEighths}
            measuredWholeInches={measuredWholeInches}
            onMeasuredFractionChange={setMeasuredFractionEighths}
            onMeasuredWholeInchesChange={setMeasuredWholeInches}
            onSaveMeasuredDistance={saveMeasuredDistance}
            onSaveVariation={saveVariation}
            onSubmissionNotesChange={setSubmissionNotes}
            onVariationFractionChange={setVariationFractionEighths}
            onVariationReasonChange={setVariationReason}
            onVariationWholeInchesChange={setVariationWholeInches}
            selectedBarFeeder={selectedBarFeeder}
            selectedLathe={selectedLathe}
            submissionMessage={submissionMessage}
            submissionNotes={submissionNotes}
            variationFractionEighths={variationFractionEighths}
            variationMessage={variationMessage}
            variationReason={variationReason}
            variationWholeInches={variationWholeInches}
            isSavingSubmission={isSavingSubmission}
            isSavingVariation={isSavingVariation}
            textInputProps={textInputProps}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function eighthsToMillimeters(eighths) {
  return Math.round((eighths * 25.4) / 8);
}

function millimetersToNearestEighths(mm) {
  return Math.round((mm * 8) / 25.4);
}

function getDistanceSelectionEighths(wholeInches, fractionEighths) {
  const normalizedWhole = wholeInches.trim() || '0';
  const whole = Number.parseInt(normalizedWhole, 10);

  if (!Number.isInteger(whole) || whole < 0 || normalizedWhole !== String(whole)) {
    return null;
  }

  const totalEighths = whole * 8 + fractionEighths;

  return totalEighths > 0 ? totalEighths : null;
}

function getDistanceRecordEighths(distanceRecord) {
  if (Number.isInteger(distanceRecord.distance_in_eighths)) {
    return distanceRecord.distance_in_eighths;
  }

  return millimetersToNearestEighths(distanceRecord.distance_mm);
}

function formatEighthsAsInches(eighths) {
  const whole = Math.floor(eighths / 8);
  const remainder = eighths % 8;

  if (!remainder) {
    return `${whole} in`;
  }

  const option = FRACTION_OPTIONS.find((fraction) => fraction.eighths === remainder);

  return `${whole} ${option.label} in`;
}

function formatModelSortName(model) {
  return `${model.manufacturer ?? ''} ${model.name}`;
}

function getTextInputThemeProps(theme) {
  return {
    placeholderTextColor: theme.placeholder,
    selectionColor: theme.accent,
  };
}

function normalizeSearchText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function getUniqueManufacturers(models) {
  return [
    ...new Set(
      models.map((model) => model.manufacturer).filter((manufacturer) => manufacturer)
    ),
  ].sort((left, right) => left.localeCompare(right));
}

function getBarFeederManufacturerRank(manufacturer) {
  if (manufacturer === 'Edge Technologies') {
    return 0;
  }

  if (manufacturer === 'FMB') {
    return 1;
  }

  return 2;
}

function groupBarFeeders(models) {
  const sortedModels = [...models].sort((left, right) => {
    const rankDifference =
      getBarFeederManufacturerRank(left.manufacturer) -
      getBarFeederManufacturerRank(right.manufacturer);

    if (rankDifference !== 0) {
      return rankDifference;
    }

    return formatModelSortName(left).localeCompare(formatModelSortName(right));
  });
  const groups = [];

  sortedModels.forEach((model) => {
    const title = model.manufacturer || 'Other';
    let group = groups.find((candidate) => candidate.title === title);

    if (!group) {
      group = { items: [], title };
      groups.push(group);
    }

    group.items.push(model);
  });

  return groups;
}

function getPublicDistanceNotes(notes) {
  return String(notes ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('Imported from spreadsheet row'))
    .join('\n');
}

function getSessionDisplayName(session) {
  const metadataName =
    session?.user?.user_metadata?.display_name || session?.user?.user_metadata?.full_name;

  if (metadataName) {
    return metadataName;
  }

  const parsedEmail = parseCompanyEmail(session?.user?.email ?? '');

  return parsedEmail.displayName || 'Company user';
}

function AuthPanel({
  authMessage,
  email,
  isAuthLoading,
  onCreateAccount,
  onEmailChange,
  onPasswordChange,
  onSignIn,
  password,
  textInputProps,
}) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.authContainer}
    >
      <ScrollView
        contentContainerStyle={styles.authScrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.authPanel}>
          <Text style={styles.authTitle}>Company Sign In</Text>
          <Text style={styles.authHint}>
            Use an @edgetechnologies.com email in the first-initial plus last-name
            format, like jdoe@edgetechnologies.com.
          </Text>

          <Text style={styles.inputLabel}>Company Email</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={onEmailChange}
            placeholder="jdoen@edgetechnologies.com"
            style={styles.input}
            textContentType="emailAddress"
            value={email}
            {...textInputProps}
          />

          <Text style={styles.inputLabel}>Password</Text>
          <TextInput
            autoCapitalize="none"
            onChangeText={onPasswordChange}
            placeholder="Password"
            secureTextEntry
            style={styles.input}
            textContentType="password"
            value={password}
            {...textInputProps}
          />

          {authMessage ? <Text style={styles.authMessage}>{authMessage}</Text> : null}

          <Pressable
            disabled={isAuthLoading}
            onPress={onSignIn}
            style={[styles.button, isAuthLoading && styles.disabledButton]}
          >
            <Text style={styles.buttonText}>
              {isAuthLoading ? 'Working...' : 'Sign In'}
            </Text>
          </Pressable>

          <Pressable
            disabled={isAuthLoading}
            onPress={onCreateAccount}
            style={[styles.outlineButton, isAuthLoading && styles.disabledOutlineButton]}
          >
            <Text style={styles.outlineButtonText}>Create Account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function LatheSelector({
  data,
  emptyMessage,
  manufacturerInputLabel,
  manufacturerInputValue,
  manufacturerPlaceholder,
  inputLabel,
  inputValue,
  isSaving,
  message,
  onAdd,
  onInputChange,
  onManufacturerInputChange,
  onSelect,
  placeholder,
  selectedId,
  submitLabel,
  textInputProps,
  title,
}) {
  const [isManufacturerOpen, setIsManufacturerOpen] = useState(false);
  const [isModelOpen, setIsModelOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const selectedModel = data.find((item) => item.id === selectedId);
  const manufacturers = getUniqueManufacturers(data);
  const selectedManufacturer =
    selectedModel?.manufacturer || manufacturers[0] || 'Manufacturer';
  const filteredModels = data.filter((item) => {
    const sameManufacturer = item.manufacturer === selectedManufacturer;
    const matchesSearch = normalizeSearchText(
      `${item.manufacturer} ${item.name}`
    ).includes(normalizeSearchText(modelSearch));

    return sameManufacturer && matchesSearch;
  });

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>

      <View style={styles.selectorPanel}>
        <TextInput
          autoCapitalize="words"
          onChangeText={(value) => {
            setModelSearch(value);
            setIsModelOpen(true);
          }}
          placeholder="Search lathes"
          style={styles.input}
          value={modelSearch}
          {...textInputProps}
        />

        <Text style={styles.inputLabel}>Manufacturer</Text>
        <Pressable
          onPress={() => setIsManufacturerOpen((isOpen) => !isOpen)}
          style={styles.selectorButton}
        >
          <Text style={styles.selectorButtonText}>{selectedManufacturer}</Text>
        </Pressable>

        {isManufacturerOpen ? (
          <View style={styles.dropdownList}>
            {manufacturers.map((manufacturer) => (
              <Pressable
                key={manufacturer}
                onPress={() => {
                  const firstModel = data.find(
                    (item) => item.manufacturer === manufacturer
                  );
                  setIsManufacturerOpen(false);
                  setIsModelOpen(true);
                  if (firstModel) {
                    onSelect(firstModel.id);
                  }
                }}
                style={styles.dropdownRow}
              >
                <Text style={styles.dropdownText}>{manufacturer}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Text style={styles.inputLabel}>Model</Text>
        <Pressable
          onPress={() => setIsModelOpen((isOpen) => !isOpen)}
          style={styles.selectorButton}
        >
          <Text style={styles.selectorButtonText}>
            {selectedModel ? selectedModel.name : 'Choose a lathe model'}
          </Text>
        </Pressable>

        {isModelOpen ? (
          <View style={styles.dropdownList}>
            {filteredModels.length ? (
              filteredModels.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    onSelect(item.id);
                    setIsModelOpen(false);
                  }}
                  style={[
                    styles.dropdownRow,
                    selectedId === item.id && styles.selectedDropdownRow,
                  ]}
                >
                  <Text
                    style={[
                      styles.dropdownText,
                      selectedId === item.id && styles.selectedDropdownText,
                    ]}
                  >
                    {item.name}
                  </Text>
                </Pressable>
              ))
            ) : (
              <Text style={styles.emptyText}>{emptyMessage}</Text>
            )}
          </View>
        ) : null}
      </View>

      <View style={styles.addModelPanel}>
        <Text style={styles.inputLabel}>{manufacturerInputLabel}</Text>
        <TextInput
          autoCapitalize="words"
          onChangeText={onManufacturerInputChange}
          placeholder={manufacturerPlaceholder}
          style={styles.input}
          value={manufacturerInputValue}
          {...textInputProps}
        />

        <Text style={styles.inputLabel}>{inputLabel}</Text>
        <TextInput
          autoCapitalize="words"
          onChangeText={onInputChange}
          placeholder={placeholder}
          style={styles.input}
          value={inputValue}
          {...textInputProps}
        />
        {message ? <Text style={styles.formMessage}>{message}</Text> : null}
        <Pressable
          disabled={isSaving}
          onPress={onAdd}
          style={[styles.outlineButton, isSaving && styles.disabledOutlineButton]}
        >
          <Text style={styles.outlineButtonText}>
            {isSaving ? 'Saving...' : submitLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function BarFeederSelector({
  data,
  emptyMessage,
  manufacturerInputValue,
  inputLabel,
  inputValue,
  isSaving,
  message,
  onAdd,
  onInputChange,
  onManufacturerInputChange,
  onSelect,
  placeholder,
  selectedId,
  submitLabel,
  textInputProps,
  title,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedModel = data.find((item) => item.id === selectedId);
  const groupedModels = groupBarFeeders(data);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>

      <View style={styles.selectorPanel}>
        <Pressable
          onPress={() => setIsOpen((isDropdownOpen) => !isDropdownOpen)}
          style={styles.selectorButton}
        >
          <Text style={styles.selectorButtonText}>
            {selectedModel
              ? `${selectedModel.manufacturer || 'Other'} · ${selectedModel.name}`
              : 'Choose a bar feeder'}
          </Text>
        </Pressable>

        {isOpen ? (
          <View style={styles.dropdownList}>
            {groupedModels.length ? (
              groupedModels.map((group) => (
                <View key={group.title}>
                  <Text style={styles.dropdownGroupTitle}>{group.title}</Text>
                  {group.items.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => {
                        onSelect(item.id);
                        setIsOpen(false);
                      }}
                      style={[
                        styles.dropdownRow,
                        selectedId === item.id && styles.selectedDropdownRow,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dropdownText,
                          selectedId === item.id && styles.selectedDropdownText,
                        ]}
                      >
                        {item.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>{emptyMessage}</Text>
            )}
          </View>
        ) : null}
      </View>

      <View style={styles.addModelPanel}>
        <ManufacturerSelector
          onSelect={onManufacturerInputChange}
          selectedManufacturer={manufacturerInputValue}
        />

        <Text style={styles.inputLabel}>{inputLabel}</Text>
        <TextInput
          autoCapitalize="words"
          onChangeText={onInputChange}
          placeholder={placeholder}
          style={styles.input}
          value={inputValue}
          {...textInputProps}
        />
        {message ? <Text style={styles.formMessage}>{message}</Text> : null}
        <Pressable
          disabled={isSaving}
          onPress={onAdd}
          style={[styles.outlineButton, isSaving && styles.disabledOutlineButton]}
        >
          <Text style={styles.outlineButtonText}>
            {isSaving ? 'Saving...' : submitLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function ManufacturerSelector({ onSelect, selectedManufacturer }) {
  return (
    <View>
      <Text style={styles.inputLabel}>Bar Feeder Manufacturer</Text>
      <View style={styles.segmentedControl}>
        {BAR_FEEDER_MANUFACTURERS.map((manufacturer) => (
          <Pressable
            key={manufacturer}
            onPress={() => onSelect(manufacturer)}
            style={[
              styles.segment,
              selectedManufacturer === manufacturer && styles.selectedSegment,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                selectedManufacturer === manufacturer && styles.selectedSegmentText,
              ]}
            >
              {manufacturer}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function RecentLookups({ lookups, onSelect }) {
  if (!lookups.length) {
    return null;
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Measurements</Text>
      </View>
      <View style={styles.recentList}>
        {lookups.map((lookup) => (
          <Pressable
            key={lookup.lookup_key}
            onPress={() => onSelect(lookup)}
            style={styles.recentRow}
          >
            <View style={styles.recentInfo}>
              <Text style={styles.recentTitle}>
                {lookup.lathe_name} with {lookup.bar_feeder_name}
              </Text>
              <Text style={styles.recentMeta}>
                {lookup.lathe_manufacturer || 'Lathe'} ·{' '}
                {lookup.bar_feeder_manufacturer || 'Bar feeder'}
              </Text>
            </View>
            <Text style={styles.recentDistance}>{lookup.distance_display}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function DistanceResult({
  distanceRecord,
  hasSelection,
  isLookupLoading,
  isSavingSubmission,
  isSavingVariation,
  lookupMessage,
  measuredFractionEighths,
  measuredWholeInches,
  onMeasuredFractionChange,
  onMeasuredWholeInchesChange,
  onSaveMeasuredDistance,
  onSaveVariation,
  onSubmissionNotesChange,
  onVariationFractionChange,
  onVariationReasonChange,
  onVariationWholeInchesChange,
  selectedBarFeeder,
  selectedLathe,
  submissionMessage,
  submissionNotes,
  variationFractionEighths,
  variationMessage,
  variationReason,
  variationWholeInches,
  textInputProps,
}) {
  if (!hasSelection) {
    return (
      <View style={styles.resultPanel}>
        <Text style={styles.resultTitle}>Choose both models</Text>
        <Text style={styles.resultText}>
          Select a lathe and bar feeder to look up the recommended setup distance.
        </Text>
      </View>
    );
  }

  if (isLookupLoading) {
    return (
      <View style={styles.resultPanel}>
        <ActivityIndicator size="small" color="#2563eb" />
        <Text style={styles.resultText}>Checking saved distance...</Text>
      </View>
    );
  }

  if (lookupMessage) {
    return (
      <View style={styles.resultPanel}>
        <Text style={styles.errorTitle}>Lookup failed</Text>
        <Text style={styles.errorText}>{lookupMessage}</Text>
      </View>
    );
  }

  if (!distanceRecord) {
    return (
      <View style={styles.resultPanel}>
        <Text style={styles.resultTitle}>Measurement Needed</Text>
        <Text style={styles.resultText}>
          No saved distance exists for {selectedLathe.name} with {selectedBarFeeder.name}.
          Take the measurement and submit it for review.
        </Text>

        <InchDistanceInput
          fractionEighths={measuredFractionEighths}
          label="Measured Distance"
          onFractionChange={onMeasuredFractionChange}
          onWholeInchesChange={onMeasuredWholeInchesChange}
          textInputProps={textInputProps}
          wholeInches={measuredWholeInches}
        />

        <Text style={styles.inputLabel}>Notes</Text>
        <TextInput
          multiline
          onChangeText={onSubmissionNotesChange}
          placeholder="Measurement context, setup notes, machine condition..."
          style={[styles.input, styles.textArea]}
          value={submissionNotes}
          {...textInputProps}
        />

        {submissionMessage ? (
          <Text style={styles.formMessage}>{submissionMessage}</Text>
        ) : null}

        <Pressable
          disabled={isSavingSubmission}
          onPress={onSaveMeasuredDistance}
          style={[styles.button, isSavingSubmission && styles.disabledButton]}
        >
          <Text style={styles.buttonText}>
            {isSavingSubmission ? 'Saving...' : 'Submit Measurement'}
          </Text>
        </Pressable>
      </View>
    );
  }

  const distanceInEighths = getDistanceRecordEighths(distanceRecord);
  const publicNotes = getPublicDistanceNotes(distanceRecord.notes);

  return (
    <View style={styles.resultPanel}>
      <Text style={styles.resultTitle}>Recommended Distance</Text>
      <Text style={styles.distanceValue}>
        {formatEighthsAsInches(distanceInEighths)}
      </Text>
      <Text style={styles.resultText}>
        {selectedLathe.name} with {selectedBarFeeder.name}
      </Text>
      {publicNotes ? (
        <Text style={styles.noteText}>{publicNotes}</Text>
      ) : null}

      <View style={styles.divider} />

      <Text style={styles.variationTitle}>Used a different measurement?</Text>
      <Text style={styles.resultText}>
        Save the measurement used and explain the install complication.
      </Text>

      <InchDistanceInput
        fractionEighths={variationFractionEighths}
        label="Measurement Used"
        onFractionChange={onVariationFractionChange}
        onWholeInchesChange={onVariationWholeInchesChange}
        textInputProps={textInputProps}
        wholeInches={variationWholeInches}
      />

      <Text style={styles.inputLabel}>Reason for Variation</Text>
      <TextInput
        multiline
        onChangeText={onVariationReasonChange}
        placeholder="Explain what prevented the recommended distance..."
        style={[styles.input, styles.textArea]}
        value={variationReason}
        {...textInputProps}
      />

      {variationMessage ? <Text style={styles.formMessage}>{variationMessage}</Text> : null}

      <Pressable
        disabled={isSavingVariation}
        onPress={onSaveVariation}
        style={[styles.outlineButton, isSavingVariation && styles.disabledOutlineButton]}
      >
        <Text style={styles.outlineButtonText}>
          {isSavingVariation ? 'Saving...' : 'Save Variation'}
        </Text>
      </Pressable>
    </View>
  );
}

function InchDistanceInput({
  fractionEighths,
  label,
  onFractionChange,
  onWholeInchesChange,
  textInputProps,
  wholeInches,
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const selectedFraction = FRACTION_OPTIONS.find(
    (option) => option.eighths === fractionEighths
  );

  return (
    <View>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inchInputRow}>
        <View style={styles.wholeInchesField}>
          <TextInput
            keyboardType="number-pad"
            onChangeText={onWholeInchesChange}
            placeholder="Inches"
            style={[styles.input, styles.inchNumberInput]}
            value={wholeInches}
            {...textInputProps}
          />
        </View>
        <View style={styles.fractionField}>
          <Pressable
            onPress={() => setIsDropdownOpen((isOpen) => !isOpen)}
            style={styles.fractionButton}
          >
            <Text style={styles.fractionButtonText}>
              {selectedFraction?.label ?? '0'}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.inchUnit}>in</Text>
      </View>

      {isDropdownOpen ? (
        <View style={styles.fractionMenu}>
          {FRACTION_OPTIONS.map((option) => (
            <Pressable
              key={option.eighths}
              onPress={() => {
                onFractionChange(option.eighths);
                setIsDropdownOpen(false);
              }}
              style={[
                styles.fractionOption,
                option.eighths === fractionEighths && styles.selectedFractionOption,
              ]}
            >
              <Text
                style={[
                  styles.fractionOptionText,
                  option.eighths === fractionEighths &&
                    styles.selectedFractionOptionText,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    backgroundColor: theme.panel,
    borderBottomColor: theme.border,
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 20,
  },
  headerTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerTitleBlock: {
    flex: 1,
    paddingRight: 14,
  },
  themeToggle: {
    borderColor: theme.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  themeToggleText: {
    color: theme.textSoft,
    fontSize: 13,
    fontWeight: '800',
  },
  eyebrow: {
    color: theme.accent,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    color: theme.text,
    fontSize: 32,
    fontWeight: '800',
    marginTop: 8,
  },
  subtitle: {
    color: theme.textSubtle,
    fontSize: 16,
    lineHeight: 22,
    marginTop: 8,
  },
  buildLabel: {
    color: theme.positive,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
  },
  content: {
    gap: 16,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  contentScroll: {
    flex: 1,
  },
  authContainer: {
    flex: 1,
  },
  authScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  authPanel: {
    backgroundColor: theme.panel,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 18,
  },
  authTitle: {
    color: theme.text,
    fontSize: 22,
    fontWeight: '800',
  },
  authHint: {
    color: theme.textSubtle,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 8,
  },
  inputLabel: {
    color: theme.textSoft,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 16,
  },
  input: {
    backgroundColor: theme.background,
    borderColor: theme.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    color: theme.text,
    fontSize: 16,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  inchNumberInput: {
    marginTop: 0,
  },
  inchInputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  wholeInchesField: {
    flex: 1,
  },
  fractionField: {
    width: 92,
  },
  fractionButton: {
    alignItems: 'center',
    backgroundColor: theme.background,
    borderColor: theme.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 46,
    paddingHorizontal: 12,
  },
  fractionButtonText: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '700',
  },
  inchUnit: {
    color: theme.textSoft,
    fontSize: 15,
    fontWeight: '700',
    width: 20,
  },
  fractionMenu: {
    backgroundColor: theme.panel,
    borderColor: theme.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    overflow: 'hidden',
  },
  fractionOption: {
    borderBottomColor: theme.separator,
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectedFractionOption: {
    backgroundColor: theme.accentMuted,
  },
  fractionOptionText: {
    color: theme.textSoft,
    fontSize: 15,
    fontWeight: '600',
  },
  selectedFractionOptionText: {
    color: theme.accent,
    fontWeight: '800',
  },
  authMessage: {
    color: theme.danger,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 14,
  },
  signedInBar: {
    alignItems: 'center',
    backgroundColor: theme.panel,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  signedInLabel: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  signedInInfo: {
    flex: 1,
    paddingRight: 12,
  },
  signedInEmail: {
    color: theme.textSubtle,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  signedInName: {
    color: theme.text,
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  section: {
    backgroundColor: theme.panel,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionHeader: {
    alignItems: 'center',
    borderBottomColor: theme.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  addModelPanel: {
    backgroundColor: theme.background,
    borderTopColor: theme.border,
    borderTopWidth: 1,
    padding: 16,
  },
  selectorPanel: {
    padding: 16,
  },
  selectorButton: {
    backgroundColor: theme.background,
    borderColor: theme.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  selectorButtonText: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '700',
  },
  dropdownList: {
    backgroundColor: theme.panel,
    borderColor: theme.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    overflow: 'hidden',
  },
  dropdownGroupTitle: {
    backgroundColor: theme.separator,
    color: theme.textSubtle,
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingVertical: 8,
    textTransform: 'uppercase',
  },
  dropdownRow: {
    borderBottomColor: theme.separator,
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectedDropdownRow: {
    backgroundColor: theme.accentMuted,
  },
  dropdownText: {
    color: theme.textSoft,
    fontSize: 15,
    fontWeight: '600',
  },
  selectedDropdownText: {
    color: theme.accent,
    fontWeight: '800',
  },
  recentList: {
    paddingVertical: 4,
  },
  recentRow: {
    alignItems: 'center',
    borderBottomColor: theme.separator,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  recentInfo: {
    flex: 1,
    paddingRight: 8,
  },
  recentTitle: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '800',
  },
  recentMeta: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  recentDistance: {
    color: theme.positive,
    fontSize: 16,
    fontWeight: '800',
  },
  segmentedControl: {
    backgroundColor: theme.border,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 2,
    marginTop: 8,
    padding: 2,
  },
  segment: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  selectedSegment: {
    backgroundColor: theme.panel,
  },
  segmentText: {
    color: theme.textSubtle,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  selectedSegmentText: {
    color: theme.accent,
  },
  sectionTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '700',
  },
  count: {
    color: theme.textSubtle,
    fontSize: 14,
    fontWeight: '700',
  },
  row: {
    borderBottomColor: theme.separator,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  selectedRow: {
    backgroundColor: theme.accentMuted,
    borderLeftColor: theme.accent,
    borderLeftWidth: 4,
  },
  rowName: {
    color: theme.textAlt,
    fontSize: 16,
    fontWeight: '600',
  },
  selectedRowName: {
    color: theme.accent,
  },
  rowMeta: {
    color: theme.muted,
    fontSize: 13,
    marginTop: 4,
  },
  centerPanel: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  mutedText: {
    color: theme.textSubtle,
    fontSize: 16,
    marginTop: 12,
  },
  errorTitle: {
    color: theme.danger,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  errorText: {
    color: theme.dangerText,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 8,
    textAlign: 'center',
  },
  button: {
    backgroundColor: theme.accent,
    borderRadius: 8,
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  disabledButton: {
    backgroundColor: theme.buttonDisabled,
  },
  buttonText: {
    color: theme.white,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  outlineButton: {
    alignItems: 'center',
    borderColor: theme.accent,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  disabledOutlineButton: {
    borderColor: theme.buttonDisabled,
  },
  outlineButtonText: {
    color: theme.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    borderColor: theme.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: theme.textSoft,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyText: {
    color: theme.muted,
    fontSize: 15,
    padding: 16,
  },
  resultPanel: {
    backgroundColor: theme.panel,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  resultTitle: {
    color: theme.text,
    fontSize: 20,
    fontWeight: '800',
  },
  resultText: {
    color: theme.textSubtle,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 8,
  },
  resultMeta: {
    color: theme.muted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  distanceValue: {
    color: theme.positive,
    fontSize: 40,
    fontWeight: '800',
    marginTop: 8,
  },
  noteText: {
    backgroundColor: theme.background,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    color: theme.textSoft,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
    padding: 12,
  },
  divider: {
    backgroundColor: theme.border,
    height: 1,
    marginVertical: 18,
  },
  variationTitle: {
    color: theme.text,
    fontSize: 17,
    fontWeight: '800',
  },
  textArea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  formMessage: {
    color: theme.textSoft,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
  },
  });
}

let styles = createStyles(lightTheme);
