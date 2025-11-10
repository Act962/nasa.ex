"use client"

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CirclePlus } from 'lucide-react';
import { useState } from "react"
import { X } from 'lucide-react';
import z from 'zod';
import { schema } from './schema';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FieldError } from '@/components/ui/field';

type CreateColumnForm = z.infer<typeof schema>


export function ButtonAddColumn(
) {

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<CreateColumnForm>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: "",
        },
    });

    const [isCreating, setIsCreating] = useState(false)

    function toggleCreating() {
        setIsCreating(!isCreating)
    }
    function handleAddColumn(data: CreateColumnForm) {
        toggleCreating()
    }

    return (
        <>
            {
                !isCreating ?
                    <div
                        className="flex ml-2 rounded-2xl gap-2 justify-center items-center flex-row px-8 py-4 bg-foreground/5 hover:bg-foreground/10 hover:transition-colors w-[350px]"
                        onClick={toggleCreating}>
                        Adicionar
                        <CirclePlus size={18}
                        />
                    </div>
                    :
                    <form onSubmit={handleSubmit(handleAddColumn)}>
                        <div className='flex flex-col gap-3
                        bg-foreground/5 rounded-2xl px-5 py-4
                    ml-2 w-[350px]'>
                            Nova coluna
                            <Input
                                {...register("name")}
                                placeholder='Ex: Coluna de compras'
                                autoFocus
                            />
                            {errors.name && <FieldError>{errors.name.message}</FieldError>}
                            <div className='
                        flex flex-row  gap-2 items-center'
                            >
                                <Button
                                    type='submit'
                                >Adicionar Lista</Button>
                                <X className='cursor-pointer hover:bg-foreground/5 p-1 rounded
                                transition-colors
                                ' onClick={toggleCreating}
                                    size={26}
                                />
                            </div>
                        </div>
                    </form>
            }

        </>

    )

}