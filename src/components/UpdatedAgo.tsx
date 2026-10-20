import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

type Props = {
  since: Date;
};

function diffSeconds(since: Date): number {
  return Math.max(0, Math.floor((Date.now() - since.getTime()) / 1000));
}

export function UpdatedAgo({ since }: Props) {
  const [seconds, setSeconds] = useState(() => diffSeconds(since));

  useEffect(() => {
    setSeconds(diffSeconds(since));
    const id = setInterval(() => setSeconds(diffSeconds(since)), 1000);
    return () => clearInterval(id);
  }, [since]);

  return <Text style={styles.text}>Обновлено {seconds} сек назад</Text>;
}

const styles = StyleSheet.create({
  text: { fontSize: 13, color: '#6b7280' },
});