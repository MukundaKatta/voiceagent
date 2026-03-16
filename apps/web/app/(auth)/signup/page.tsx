import { SignupForm } from './signup-form';

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">VoiceAgent</h1>
          <p className="text-muted-foreground">Create your account</p>
        </div>
        <SignupForm />
      </div>
    </div>
  );
}
