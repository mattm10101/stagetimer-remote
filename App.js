import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  Text,
  Pressable,
  TextInput,
  RefreshControl,
  Animated,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

// Default values, will be replaced by saved settings
const DEFAULT_ROOM_ID = '55T3E3HN';
const DEFAULT_API_KEY = '087a607d0b6b88601123f9ccdba3a898';

const API_BASE_URL = 'https://api.stagetimer.io/v1';
const SOCKET_URL = 'https://api.stagetimer.io';

const TIMER_PRESETS = [
  { label: '30 seconds', duration: { seconds: 30 } },
  { label: '1 minute', duration: { minutes: 1 } },
  { label: '2 minutes', duration: { minutes: 2 } },
  { label: '5 minutes', duration: { minutes: 5 } },
  { label: '10 minutes', duration: { minutes: 10 } },
];

const ADJUST_TIME_PRESETS = [
  { label: '30 seconds', value: 30000 },
  { label: '1 minute', value: 60000 },
  { label: '2 minutes', value: 120000 },
  { label: '5 minutes', value: 300000 },
  { label: '15 minutes', value: 900000 },
  { label: '30 minutes', value: 1800000 },
  { label: '60 minutes', value: 3600000 },
];

// Toast Component
const Toast = ({ visible, message, type, onHide }) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(2500),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => onHide());
    }
  }, [visible]);

  if (!visible) return null;

  const bgColor = type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#333';

  return (
    <Animated.View style={[styles.toast, { opacity, backgroundColor: bgColor }]}>
      <Icon name={type === 'error' ? 'error' : type === 'success' ? 'check-circle' : 'info'} size={20} color="#fff" />
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
};

// Format duration helper
const formatDuration = (timer) => {
  const hours = timer.hours || 0;
  const minutes = timer.minutes || 0;
  const seconds = timer.seconds || 0;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export default function App() {
  // --- STATE MANAGEMENT ---
  const [roomId, setRoomId] = useState(DEFAULT_ROOM_ID);
  const [apiKey, setApiKey] = useState(DEFAULT_API_KEY);
  // Temp state for settings inputs
  const [tempRoomId, setTempRoomId] = useState('');
  const [tempApiKey, setTempApiKey] = useState('');

  const [isRunning, setIsRunning] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [timers, setTimers] = useState([]);
  const [currentTimerId, setCurrentTimerId] = useState(null);
  const [selectedTimerId, setSelectedTimerId] = useState(null);

  // Foldable states
  const [isTimersExpanded, setIsTimersExpanded] = useState(true);
  const [isAddTimerExpanded, setIsAddTimerExpanded] = useState(false);
  const [isDeleteTimerExpanded, setIsDeleteTimerExpanded] = useState(false);
  const [isAdjustTimeExpanded, setIsAdjustTimeExpanded] = useState(false);
  const [isActionsExpanded, setIsActionsExpanded] = useState(false);
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);

  const [editingTimerId, setEditingTimerId] = useState(null);
  const [editingTimerName, setEditingTimerName] = useState('');
  const [isFlashing, setIsFlashing] = useState(false);
  const [compactViewer, setCompactViewer] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // New states
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });
  const [customTimerModal, setCustomTimerModal] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');
  const [customSeconds, setCustomSeconds] = useState('');
  const [customTimerName, setCustomTimerName] = useState('');

  const socketRef = useRef(null);
  const viewerUrl = `https://stagetimer.io/r/${roomId}/`;

  // --- TOAST HELPER ---
  const showToast = (message, type = 'info') => {
    setToast({ visible: true, message, type });
  };

  // --- HAPTIC FEEDBACK ---
  const triggerHaptic = (type = 'light') => {
    if (type === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else if (type === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else if (type === 'heavy') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    else if (type === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (type === 'error') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  };

  // --- API & DATA ---
  const sendApiRequest = useCallback(async (endpoint, params = {}) => {
    if (!roomId || !apiKey) {
      showToast('Please set Room ID and API Key in Settings', 'error');
      triggerHaptic('error');
      return;
    }
    try {
      const query = new URLSearchParams({ room_id: roomId, api_key: apiKey, ...params });
      const url = `${API_BASE_URL}${endpoint}?${query.toString()}`;
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      console.error('API Error:', e);
      showToast(e.message, 'error');
      triggerHaptic('error');
    }
  }, [roomId, apiKey]);

  const fetchAllTimers = useCallback(async () => {
    if (!roomId || !apiKey) return;
    try {
      const query = new URLSearchParams({ room_id: roomId, api_key: apiKey });
      const url = `${API_BASE_URL}/get_all_timers?${query.toString()}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || 'Failed to fetch timers');
      setTimers(json.data || []);
    } catch (e) {
      console.error('Fetch Timers Error:', e);
      setTimers([]);
    }
  }, [roomId, apiKey]);

  // --- PULL TO REFRESH ---
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    triggerHaptic('light');
    await fetchAllTimers();
    setRefreshing(false);
    showToast('Timers refreshed', 'success');
  }, [fetchAllTimers]);

  // --- SETTINGS PERSISTENCE ---
  const saveSettings = async () => {
    try {
      await AsyncStorage.setItem('@roomId', tempRoomId);
      await AsyncStorage.setItem('@apiKey', tempApiKey);
      setRoomId(tempRoomId);
      setApiKey(tempApiKey);
      setIsSettingsExpanded(false);
      showToast('Settings saved successfully', 'success');
      triggerHaptic('success');
    } catch (e) {
      showToast('Failed to save settings', 'error');
      triggerHaptic('error');
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedRoomId = await AsyncStorage.getItem('@roomId');
        const savedApiKey = await AsyncStorage.getItem('@apiKey');
        if (savedRoomId !== null) {
          setRoomId(savedRoomId);
          setTempRoomId(savedRoomId);
        }
        if (savedApiKey !== null) {
          setApiKey(savedApiKey);
          setTempApiKey(savedApiKey);
        }
      } catch (e) {
        showToast('Failed to load settings', 'error');
      }
    };
    loadSettings();
  }, []);

  // --- LIFECYCLE & SOCKETS ---
  useEffect(() => {
    fetchAllTimers();
  }, [fetchAllTimers]);

  useEffect(() => {
    if (!roomId || !apiKey) {
      setIsConnected(false);
      return;
    }
    const socket = io(SOCKET_URL, { path: '/v1/socket.io', auth: { room_id: roomId, api_key: apiKey } });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });
    socket.on('disconnect', () => {
      setIsConnected(false);
    });
    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      setIsConnected(false);
    });
    socket.on('playback_status', (data) => {
      setIsRunning(!!data?.running);
      setCurrentTimerId(data?.timer_id);
      if (selectedTimerId === data?.timer_id) setSelectedTimerId(null);
    });
    socket.on('timers', () => fetchAllTimers());
    return () => socket.disconnect();
  }, [roomId, apiKey, fetchAllTimers, selectedTimerId]);

  // --- RETRY CONNECTION ---
  const handleRetryConnection = () => {
    triggerHaptic('medium');
    if (socketRef.current) {
      socketRef.current.connect();
      showToast('Reconnecting...', 'info');
    }
  };

  // --- EVENT HANDLERS ---
  const handleUpdateTimerName = async (timerId, newName) => {
    if (editingTimerId !== timerId) return;
    const originalTimer = timers.find((t) => t._id === timerId);
    if (!newName.trim() || (originalTimer && originalTimer.name === newName)) {
      setEditingTimerId(null);
      return;
    }
    await sendApiRequest('/update_timer', { timer_id: timerId, name: newName });
    await fetchAllTimers();
    setEditingTimerId(null);
    showToast('Timer renamed', 'success');
  };

  const handleAddTimer = async (duration, label) => {
    triggerHaptic('medium');
    await sendApiRequest('/create_timer', { name: `New ${label} Timer`, ...duration });
    await fetchAllTimers();
    showToast(`Added ${label} timer`, 'success');
  };

  const handleAddCustomTimer = async () => {
    const mins = parseInt(customMinutes) || 0;
    const secs = parseInt(customSeconds) || 0;
    if (mins === 0 && secs === 0) {
      showToast('Please enter a valid duration', 'error');
      triggerHaptic('error');
      return;
    }
    triggerHaptic('medium');
    const name = customTimerName.trim() || `Custom ${mins}:${secs.toString().padStart(2, '0')} Timer`;
    await sendApiRequest('/create_timer', { name, minutes: mins, seconds: secs });
    await fetchAllTimers();
    setCustomTimerModal(false);
    setCustomMinutes('');
    setCustomSeconds('');
    setCustomTimerName('');
    showToast('Custom timer added', 'success');
  };

  const confirmDelete = (timer) => {
    triggerHaptic('medium');
    Alert.alert('Delete Timer', `Are you sure you want to delete "${timer.name}"?`,
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => {
        await sendApiRequest('/delete_timer', { timer_id: timer._id });
        await fetchAllTimers();
        showToast(`Deleted "${timer.name}"`, 'success');
        triggerHaptic('success');
      }}],
    );
  };

  const handlePlayTimer = (timerId) => {
    triggerHaptic('medium');
    sendApiRequest('/start_timer', { timer_id: timerId });
  };

  const handleStartPause = () => {
    triggerHaptic('heavy');
    sendApiRequest('/start_or_stop');
  };

  const handleNext = () => {
    triggerHaptic('medium');
    sendApiRequest('/next');
  };

  const handlePrevious = () => {
    triggerHaptic('medium');
    sendApiRequest('/previous');
  };

  const handleReset = () => {
    triggerHaptic('medium');
    sendApiRequest('/reset');
    showToast('Timer reset', 'info');
  };

  const handleToggleMessage = () => {
    triggerHaptic('light');
    sendApiRequest('/show_or_hide_message');
  };

  const handleToggleFlash = () => {
    triggerHaptic('medium');
    const endpoint = isFlashing ? '/stop_flashing' : '/start_flashing';
    sendApiRequest(endpoint);
    setIsFlashing(!isFlashing);
    showToast(isFlashing ? 'Flash stopped' : 'Flash started', 'info');
  };

  const handleAddTime = (milliseconds) => {
    triggerHaptic('light');
    sendApiRequest('/jump', { milliseconds });
  };

  const handleSubtractTime = (milliseconds) => {
    triggerHaptic('light');
    sendApiRequest('/jump', { milliseconds: -milliseconds });
  };

  // --- RENDER ---
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <Pressable
          style={[styles.viewerFrame, compactViewer && styles.viewerFrameCompact]}
          onPress={() => { triggerHaptic('light'); setCompactViewer(!compactViewer); }}
        >
          <View style={styles.viewerInner}>
            <WebView source={{ uri: viewerUrl }} style={styles.webview} javaScriptEnabled domStorageEnabled startInLoadingState />
          </View>
        </Pressable>

        <ScrollView
          style={styles.middle}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#00e5ff"
              colors={['#00e5ff']}
            />
          }
        >
          <View style={styles.foldableFrame}>
            <Pressable style={styles.foldableHeader} onPress={() => { triggerHaptic('light'); setIsTimersExpanded(!isTimersExpanded); }}>
              <Text style={styles.headerText}>Timers</Text>
              <Icon name={isTimersExpanded ? 'expand-less' : 'expand-more'} size={30} color="#00e5ff" />
            </Pressable>
            {isTimersExpanded && (
              <ScrollView style={styles.foldableContentScrollable} nestedScrollEnabled>
                {timers.length > 0 ? (timers.map((timer, index) => {
                  const isCurrent = timer._id === currentTimerId;
                  const isSelected = timer._id === selectedTimerId;
                  const isEditing = timer._id === editingTimerId;

                  return (
                    <View key={timer._id} style={[styles.timerItemWrapper, index === timers.length - 1 && { borderBottomWidth: 0 }]}>
                      <Pressable
                        onPress={() => { if (isEditing) return; triggerHaptic('light'); setSelectedTimerId(isSelected ? null : timer._id); }}
                        onLongPress={() => { if (!isEditing) { triggerHaptic('medium'); setEditingTimerId(timer._id); setEditingTimerName(timer.name); }}}
                        style={[styles.timerItemContent, isCurrent && styles.activeTimerItem, isSelected && !isCurrent && styles.selectedTimerItem ]}
                      >
                        <View style={styles.timerNameContainer}>
                          {isEditing ? (
                            <TextInput value={editingTimerName} onChangeText={setEditingTimerName} onBlur={() => handleUpdateTimerName(timer._id, editingTimerName)} style={[styles.timerName, isCurrent && styles.activeTimerName]} autoFocus selectTextOnFocus />
                          ) : (
                            <>
                              <Text style={[styles.timerName, isCurrent && styles.activeTimerName]} numberOfLines={1}>{timer.name}</Text>
                              <Text style={[styles.timerDuration, isCurrent && styles.activeTimerDuration]}>{formatDuration(timer)}</Text>
                            </>
                          )}
                        </View>
                        <View style={styles.iconContainer}>
                          {isCurrent ? (
                            <TouchableOpacity onPress={() => handleStartPause()}>
                              <Icon name={isRunning ? 'pause-circle-filled' : 'play-circle-filled'} size={36} color={isRunning ? '#dc3545' : '#28a745'} />
                            </TouchableOpacity>
                          ) : isSelected ? (
                            <TouchableOpacity onPress={() => handlePlayTimer(timer._id)}>
                              <Icon name="play-circle-filled" size={36} color="#28a745" />
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </Pressable>
                    </View>
                  );
                })) : (<Text style={styles.loadingText}>No timers found. Pull down to refresh.</Text>)}
              </ScrollView>
            )}
          </View>

          <View style={styles.foldableFrame}>
            <Pressable style={styles.foldableHeader} onPress={() => { triggerHaptic('light'); setIsAddTimerExpanded(!isAddTimerExpanded); }}>
              <Text style={styles.headerText}>Add Timer</Text>
              <Icon name={isAddTimerExpanded ? 'expand-less' : 'expand-more'} size={30} color="#00e5ff" />
            </Pressable>
            {isAddTimerExpanded && (
              <View style={styles.foldableContent}>
                {TIMER_PRESETS.map(({ label, duration }) => (
                  <TouchableOpacity key={label} style={styles.presetItem} onPress={() => handleAddTimer(duration, label)}>
                    <Icon name="add-circle-outline" size={24} color="#5bc0de" />
                    <Text style={styles.presetItemText}>{label}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={[styles.presetItem, styles.customTimerButton]} onPress={() => { triggerHaptic('light'); setCustomTimerModal(true); }}>
                  <Icon name="timer" size={24} color="#00e5ff" />
                  <Text style={[styles.presetItemText, { color: '#00e5ff' }]}>Custom duration...</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.foldableFrame}>
            <Pressable style={styles.foldableHeader} onPress={() => { triggerHaptic('light'); setIsDeleteTimerExpanded(!isDeleteTimerExpanded); }}>
              <Text style={styles.headerText}>Delete Timer</Text>
              <Icon name={isDeleteTimerExpanded ? 'expand-less' : 'expand-more'} size={30} color="#00e5ff" />
            </Pressable>
            {isDeleteTimerExpanded && (
              <View style={styles.foldableContent}>
                {timers.length > 0 ? (timers.map((timer, index) => (
                  <TouchableOpacity key={timer._id} style={[styles.deleteItem, index === timers.length - 1 && { borderBottomWidth: 0 }]} onPress={() => confirmDelete(timer)}>
                    <Icon name="remove-circle-outline" size={24} color="#dc3545" />
                    <Text style={styles.deleteItemText}>{timer.name}</Text>
                    <Text style={styles.deleteItemDuration}>{formatDuration(timer)}</Text>
                  </TouchableOpacity>
                ))) : (<Text style={styles.loadingText}>No timers to delete.</Text>)}
              </View>
            )}
          </View>

          <View style={styles.foldableFrame}>
            <Pressable style={styles.foldableHeader} onPress={() => { triggerHaptic('light'); setIsAdjustTimeExpanded(!isAdjustTimeExpanded); }}>
              <Text style={styles.headerText}>Add / Subtract Time</Text>
              <Icon name={isAdjustTimeExpanded ? 'expand-less' : 'expand-more'} size={30} color="#00e5ff" />
            </Pressable>
            {isAdjustTimeExpanded && (
              <View style={styles.foldableContent}>
                {ADJUST_TIME_PRESETS.map((preset) => (
                    <View key={preset.label} style={styles.adjustTimeRow}>
                        <TouchableOpacity style={styles.adjustTimeButton} onPress={() => handleSubtractTime(preset.value)}>
                            <Icon name="remove" size={24} color="#dc3545" />
                        </TouchableOpacity>
                        <Text style={styles.adjustTimeLabel}>{preset.label}</Text>
                        <TouchableOpacity style={styles.adjustTimeButton} onPress={() => handleAddTime(preset.value)}>
                            <Icon name="add" size={24} color="#28a745" />
                        </TouchableOpacity>
                    </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.foldableFrame}>
            <Pressable style={styles.foldableHeader} onPress={() => {
              triggerHaptic('light');
              setTempRoomId(roomId);
              setTempApiKey(apiKey);
              setIsSettingsExpanded(!isSettingsExpanded);
            }}>
              <Text style={styles.headerText}>Settings</Text>
              <Icon name={isSettingsExpanded ? 'expand-less' : 'expand-more'} size={30} color="#00e5ff" />
            </Pressable>
            {isSettingsExpanded && (
              <View style={styles.foldableContent}>
                <Text style={styles.inputLabel}>Room ID</Text>
                <TextInput
                  style={styles.input}
                  value={tempRoomId}
                  onChangeText={setTempRoomId}
                  placeholder="e.g., 55T3E3HN"
                  placeholderTextColor="#666"
                  autoCapitalize="characters"
                />
                <Text style={styles.inputLabel}>API Key</Text>
                <TextInput
                  style={styles.input}
                  value={tempApiKey}
                  onChangeText={setTempApiKey}
                  placeholder="Your API Key"
                  placeholderTextColor="#666"
                  secureTextEntry
                />
                <TouchableOpacity style={styles.saveButton} onPress={saveSettings}>
                  <Text style={styles.saveButtonText}>Save & Reconnect</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={styles.actionsContainer}>
          <Pressable style={styles.actionsHeader} onPress={() => { triggerHaptic('light'); setIsActionsExpanded(!isActionsExpanded); }}>
            <Text style={styles.actionsHeaderText}>Additional controls</Text>
            <Icon name={isActionsExpanded ? 'expand-more' : 'expand-less'} size={24} color="#888" />
          </Pressable>
          {isActionsExpanded && (
            <View style={styles.actionsContent}>
              <TouchableOpacity style={styles.extraBtn} onPress={handleReset}>
                <Icon name="refresh" size={24} color="#ccc" />
                <Text style={styles.extraBtnText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.extraBtn} onPress={handleToggleMessage}>
                <Icon name="message" size={24} color="#ccc" />
                <Text style={styles.extraBtnText}>Message</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.extraBtn, isFlashing && styles.extraBtnActive]} onPress={handleToggleFlash}>
                <Icon name="flash-on" size={24} color={isFlashing ? '#00e5ff' : '#ccc'} />
                <Text style={[styles.extraBtnText, isFlashing && styles.extraBtnTextActive]}>Flash</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Pressable style={styles.controlsToggle} onPress={() => { triggerHaptic('light'); setShowControls(!showControls); }}>
          <Icon name={showControls ? 'expand-more' : 'expand-less'} size={20} color="#666" />
        </Pressable>

        {showControls && (
          <View style={styles.controls}>
            <TouchableOpacity style={[styles.btn, styles.navBtn]} onPress={handlePrevious}><Icon name="skip-previous" size={40} color="#5bc0de" /></TouchableOpacity>
            <TouchableOpacity style={[styles.btn, isRunning ? styles.pauseBtn : styles.playBtn]} onPress={handleStartPause}><Icon name={isRunning ? 'pause' : 'play-arrow'} size={50} color="#fff" /></TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.navBtn]} onPress={handleNext}><Icon name="skip-next" size={40} color="#5bc0de" /></TouchableOpacity>
          </View>
        )}

        {/* Toast */}
        <Toast
          visible={toast.visible}
          message={toast.message}
          type={toast.type}
          onHide={() => setToast({ ...toast, visible: false })}
        />

        {/* Custom Timer Modal */}
        <Modal
          visible={customTimerModal}
          transparent
          animationType="fade"
          onRequestClose={() => setCustomTimerModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Create Custom Timer</Text>

              <Text style={styles.inputLabel}>Timer Name (optional)</Text>
              <TextInput
                style={styles.input}
                value={customTimerName}
                onChangeText={setCustomTimerName}
                placeholder="e.g., Intro Speech"
                placeholderTextColor="#666"
              />

              <Text style={styles.inputLabel}>Duration</Text>
              <View style={styles.durationInputRow}>
                <View style={styles.durationInputGroup}>
                  <TextInput
                    style={[styles.input, styles.durationInput]}
                    value={customMinutes}
                    onChangeText={setCustomMinutes}
                    placeholder="0"
                    placeholderTextColor="#666"
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <Text style={styles.durationLabel}>min</Text>
                </View>
                <Text style={styles.durationSeparator}>:</Text>
                <View style={styles.durationInputGroup}>
                  <TextInput
                    style={[styles.input, styles.durationInput]}
                    value={customSeconds}
                    onChangeText={setCustomSeconds}
                    placeholder="00"
                    placeholderTextColor="#666"
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <Text style={styles.durationLabel}>sec</Text>
                </View>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalCancelButton} onPress={() => { setCustomTimerModal(false); triggerHaptic('light'); }}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalCreateButton} onPress={handleAddCustomTimer}>
                  <Text style={styles.modalCreateText}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },

  // Status bar
  statusBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 12 },
  statusConnected: { backgroundColor: '#28a745' },
  statusDisconnected: { backgroundColor: '#dc3545' },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '600', marginLeft: 6 },
  retryButton: { flexDirection: 'row', alignItems: 'center', marginLeft: 12, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  retryText: { color: '#fff', fontSize: 12, marginLeft: 4 },

  // Viewer
  viewerFrame: { height: 150, padding: 6, borderRadius: 18, borderWidth: 3, borderColor: '#00e5ff', backgroundColor: '#00181c', shadowColor: '#00e5ff', shadowOpacity: 0.8, shadowRadius: 12, elevation: 10, marginHorizontal: 10, marginTop: 10 },
  viewerFrameCompact: { height: 80 },
  viewerInner: { flex: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' },
  webview: { flex: 1 },

  // Middle scroll area
  middle: { flex: 1, paddingHorizontal: 10, paddingTop: 20 },

  // Foldable sections
  foldableFrame: { marginBottom: 20, padding: 6, borderRadius: 18, borderWidth: 3, borderColor: '#00e5ff', backgroundColor: '#00181c', shadowColor: '#00e5ff', shadowOpacity: 0.8, shadowRadius: 12, elevation: 10 },
  foldableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10 },
  headerText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  foldableContent: { paddingHorizontal: 10, paddingBottom: 10, marginTop: 10, borderTopWidth: 1, borderTopColor: '#004a54' },
  foldableContentScrollable: { paddingHorizontal: 10, paddingBottom: 10, marginTop: 10, borderTopWidth: 1, borderTopColor: '#004a54', maxHeight: 250 },

  // Timer items
  timerItemWrapper: { borderBottomWidth: 1, borderBottomColor: '#003339' },
  timerItemContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  timerNameContainer: { flex: 1, marginRight: 10 },
  timerName: { color: '#eee', fontSize: 16 },
  timerDuration: { color: '#888', fontSize: 13, marginTop: 2 },
  activeTimerItem: { backgroundColor: 'rgba(0, 229, 255, 0.15)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 8 },
  activeTimerName: { color: '#00e5ff', fontWeight: 'bold' },
  activeTimerDuration: { color: '#00e5ff' },
  selectedTimerItem: { borderColor: '#5bc0de', borderWidth: 2, borderRadius: 6, backgroundColor: 'rgba(91, 192, 222, 0.1)', paddingVertical: 8, paddingHorizontal: 8 },
  iconContainer: { flexDirection: 'row', alignItems: 'center' },
  loadingText: { color: '#888', paddingVertical: 12 },

  // Presets
  presetItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#003339' },
  presetItemText: { color: '#eee', marginLeft: 10, fontSize: 16 },
  customTimerButton: { borderBottomWidth: 0, marginTop: 8, borderTopWidth: 1, borderTopColor: '#004a54', paddingTop: 16, marginBottom: 4 },

  // Delete items
  deleteItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#003339' },
  deleteItemText: { color: '#eee', marginLeft: 10, fontSize: 16, flex: 1 },
  deleteItemDuration: { color: '#888', fontSize: 13 },

  // Actions
  actionsContainer: { paddingHorizontal: 10, paddingBottom: 10, borderTopWidth: 1, borderTopColor: '#222' },
  actionsHeader: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 8 },
  actionsHeaderText: { color: '#888', fontSize: 14, marginRight: 4 },
  actionsContent: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#222' },
  extraBtn: { alignItems: 'center', padding: 8, borderRadius: 8, width: 80, marginHorizontal: 10 },
  extraBtnActive: { backgroundColor: 'rgba(0, 229, 255, 0.15)' },
  extraBtnText: { color: '#ccc', marginTop: 4, fontSize: 12 },
  extraBtnTextActive: { color: '#00e5ff' },

  // Adjust time
  adjustTimeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  adjustTimeLabel: { color: '#eee', fontSize: 16, textAlign: 'center' },
  adjustTimeButton: { backgroundColor: '#222', padding: 8, borderRadius: 20 },

  // Settings inputs
  inputLabel: { color: '#ccc', fontSize: 14, marginTop: 10, marginBottom: 5 },
  input: { backgroundColor: '#000', color: '#fff', borderRadius: 6, borderWidth: 1, borderColor: '#333', paddingHorizontal: 10, paddingVertical: 8, fontSize: 16 },
  saveButton: { backgroundColor: '#00e5ff', borderRadius: 6, paddingVertical: 12, alignItems: 'center', marginTop: 20 },
  saveButtonText: { color: '#00181c', fontSize: 16, fontWeight: 'bold' },

  // Controls
  controlsToggle: { alignItems: 'center', paddingVertical: 4, backgroundColor: '#000' },
  controls: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: '#000', paddingVertical: 16 },
  btn: { padding: 20, borderRadius: 50, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center', marginHorizontal: 10 },
  pauseBtn: { backgroundColor: '#dc3545' },
  playBtn: { backgroundColor: '#28a745' },
  navBtn: { backgroundColor: '#222' },

  // Toast
  toast: { position: 'absolute', bottom: 100, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, zIndex: 1000 },
  toastText: { color: '#fff', fontSize: 14, marginLeft: 8, flex: 1 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 24, width: '85%', maxWidth: 400, borderWidth: 2, borderColor: '#00e5ff' },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  durationInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  durationInputGroup: { alignItems: 'center' },
  durationInput: { width: 70, textAlign: 'center', fontSize: 24 },
  durationLabel: { color: '#888', fontSize: 12, marginTop: 4 },
  durationSeparator: { color: '#fff', fontSize: 24, marginHorizontal: 12 },
  modalButtons: { flexDirection: 'row', marginTop: 24, justifyContent: 'space-between' },
  modalCancelButton: { flex: 1, padding: 14, borderRadius: 8, backgroundColor: '#333', marginRight: 8, alignItems: 'center' },
  modalCancelText: { color: '#ccc', fontSize: 16 },
  modalCreateButton: { flex: 1, padding: 14, borderRadius: 8, backgroundColor: '#00e5ff', marginLeft: 8, alignItems: 'center' },
  modalCreateText: { color: '#00181c', fontSize: 16, fontWeight: 'bold' },
});
