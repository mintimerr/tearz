import { Redirect } from 'expo-router';

/** Любой неизвестный путь → корень (auth/hub). */
export default function NotFound() {
  return <Redirect href="/" />;
}
