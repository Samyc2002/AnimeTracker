export function AuthInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-4 py-2 bg-[#0b0e14] border border-[#253040] rounded-lg text-gray-200 focus:border-teal-500 outline-none"
    />
  );
}
