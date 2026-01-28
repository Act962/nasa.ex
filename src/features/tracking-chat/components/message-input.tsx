import { Input } from "@/components/ui/input";
import { InputHTMLAttributes } from "react";
import { FieldError, FieldValues, UseFormRegister } from "react-hook-form";

interface MessageInputProps extends InputHTMLAttributes<HTMLInputElement> {
  register?: UseFormRegister<FieldValues>;
  errors?: FieldError;
}

export function MessageInput({
  register,
  errors,
  ...props
}: MessageInputProps) {
  return (
    <div className="relative w-full">
      <Input
        {...props}
        autoCapitalize={props.id}
        {...register?.(props.id!, { required: props.required })}
        placeholder={props.placeholder}
        className="w-full"
      />
    </div>
  );
}
