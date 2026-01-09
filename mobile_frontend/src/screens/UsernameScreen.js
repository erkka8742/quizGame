import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function UsernameScreen({ navigation }) {
  const [username, setUsername] = useState('');

  useEffect(() => {
    const loadData = async () => {
      const storedName = await AsyncStorage.getItem('username');
      if (storedName) {
        navigation.navigate('GameSelect', { username: storedName });
      }
    };

    loadData();
  }, []);

  const handleSubmit = async () => {
    if (username.trim()) {
      await AsyncStorage.setItem('username', username.trim());
      navigation.navigate('GameSelect', { username: username.trim() });
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <Text style={styles.title}>AI-Smart10</Text>

      <View style={styles.formContainer}>
        <Text style={styles.label}>Enter username</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="Username..."
          placeholderTextColor="#666"
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={handleSubmit}
          returnKeyType="done"
        />
        <TouchableOpacity
          style={[styles.button, !username.trim() && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!username.trim()}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#ff8c42',
    textAlign: 'center',
    marginBottom: 60,
  },
  formContainer: {
    alignItems: 'center',
  },
  label: {
    fontSize: 18,
    color: '#888',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'rgba(255, 140, 66, 0.3)',
    borderRadius: 10,
    padding: 16,
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#ff8c42',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
});
