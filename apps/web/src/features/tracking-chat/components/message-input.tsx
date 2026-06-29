import { Input } from "@/components/ui/input";
import { forwardRef, InputHTMLAttributes } from "react";
import { FieldError, FieldValues, UseFormRegister } from "react-hook-form";

interface MessageInputProps extends InputHTMLAttributes<HTMLInputElement> {
  register?: UseFormRegister<FieldValues>;
  errors?: FieldError;
}

export const MessageInput = forwardRef<HTMLInputElement, MessageInputProps>(
  ({ register, errors, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <Input
          {...props}
          ref={ref}
          autoCapitalize={props.id}
          {...register?.(props.id!, { required: props.required })}
          placeholder={props.placeholder}
          className="w-full"
        />
      </div>
    );
  },
);

MessageInput.displayName = "MessageInput";
