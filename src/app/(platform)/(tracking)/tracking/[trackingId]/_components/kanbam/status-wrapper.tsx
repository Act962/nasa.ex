interface StatusWrapperProps {
  children: React.ReactNode;
}

export const StatusWrapper = ({ children }: StatusWrapperProps) => {
  return <li className="shrink-0 h-full w-[272px] select-none">{children}</li>;
};
