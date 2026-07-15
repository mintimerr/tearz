import { StyleSheet, View } from 'react-native';

import { TeacherPremiumScreen } from '@/components/teacher/TeacherPremiumScreen';

export default function TeacherScreen() {
  return (
    <View style={styles.host}>
      <TeacherPremiumScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
});
