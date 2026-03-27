"use client";
import React, { useRef, useState } from "react";
import { FormBlockInstance } from "@/features/form/types";
import { Button } from "@/components/ui/button";
import { FormBlocks } from "@/features/form/lib/form-blocks";
import { Loader } from "lucide-react";
import { toast } from "sonner";
import { useMutationSubmitResponse } from "../../hooks/use-form";
import { Card, CardContent } from "@/components/ui/card";

const FormSubmitComponent = (props: {
  id: string;
  blocks: FormBlockInstance[];
}) => {
  const { id, blocks } = props;
  const submitResponse = useMutationSubmitResponse();

  const formVals = useRef<{ [key: string]: string }>({});
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitted, setSubmitted] = useState<boolean>(false);

  // Validate all fields
  const validateFields = () => {
    const errors: { [key: string]: string } = {};
    blocks.forEach((block) => {
      if (!block.childblocks) return;
      block.childblocks?.forEach((childblock) => {
        const required = childblock.attributes?.required;
        const blockValue = formVals.current?.[childblock.id]?.trim();

        // Check if field is required and empty
        if (required && (!blockValue || blockValue.trim() === "")) {
          errors[childblock.id] = "This Field is required";
        }
      });
    });
    setFormErrors(errors); // Update state with errors
    return Object.keys(errors).length === 0; // Return true if no errors
  };

  const handleBlur = (key: string, value: string) => {
    formVals.current[key] = value;

    if (formErrors[key] && value?.trim() !== "") {
      setFormErrors((prevErrors) => {
        const updatedErrors = { ...prevErrors };
        delete updatedErrors[key]; // Remove the key from errors
        return updatedErrors;
      });
    }
  };

  const handleSubmit = async () => {
    if (!validateFields()) {
      toast("Validation Error");
      return;
    }

    setIsLoading(true);
    const responseJson = JSON.stringify(formVals.current);
    submitResponse.mutate(
      { id, response: responseJson },

      {
        onSuccess: () => {
          setSubmitted(true);
        },
        onError: (error) => {
          toast("Algo deu errado");
        },
      },
    );
  };

  return (
    <div
      className="scrollbar w-full h-full
  overflow-y-auto pt-3 transition-all duration-300
  "
    >
      <div
        className="w-full h-full 
      max-w-[650px] mx-auto"
      >
        <div
          className="w-full relative 
          bg-transparent px-2
            flex flex-col 
            items-center 
            justify-start pt-1 
            pb-14"
        >
          <div
            className="w-full mb-3
             bg-foreground/10 bg-[url(/images/form-bg.jpg)] 
             bg-center bg-cover border shadow-sm 
             h-[135px] max-w-[768px]
          rounded-md px-1"
          />

          <div className="w-full h-auto">
            {isSubmitted ? (
              <Card
                className="w-full bg-foreground/10 border
               shadow-sm min-h-[120px] rounded-md p-0"
              >
                <CardContent className="px-2 pb-2">
                  <div className="py-4 px-3">
                    <h1 className="text-4xl font-normal">Obrigado!</h1>
                    <p className="mt-2 mb-8 text-base">
                      Recebemos seu formulário
                    </p>
                    <a
                      href="#"
                      className="outline-none 
                      underline text-sm  text-blue-700"
                    >
                      Saiba mais
                    </a>
                  </div>
                </CardContent>
              </Card>
            ) : (
              blocks.length > 0 && (
                <div className="flex flex-col w-full gap-4">
                  {blocks.map((block) => {
                    const FormBlockComponent =
                      FormBlocks[block.blockType].formComponent;

                    return (
                      <FormBlockComponent
                        key={block.id}
                        blockInstance={block}
                        handleBlur={handleBlur}
                        formErrors={formErrors}
                      />
                    );
                  })}
                  <div className="w-ful">
                    <Button
                      className="bg-primary"
                      disabled={isLoading}
                      onClick={handleSubmit}
                    >
                      {isLoading && <Loader className="w-4 h-4 animate-spin" />}
                      Enviar
                    </Button>
                  </div>
                </div>
              )
            )}
          </div>

          {/* <div
            className="flex items-center 
          flex-col gap-2
          justify-center
          mt-5"
          >
            <p className="text-xs ">Never submit passwords through Formy.ai.</p>
            <Logo url="#" color="text-primary" />
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default FormSubmitComponent;
