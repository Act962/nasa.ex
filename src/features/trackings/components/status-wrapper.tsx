interface StatusWrapperProps {
  children: React.ReactNode;
}

export const StatusWrapper = ({ children }: StatusWrapperProps) => {
  return <li className="shrink-0 h-full w-68 select-none">{children}</li>;
};
