// import {
//   InputGroup,
//   InputGroupAddon,
//   InputGroupButton,
//   InputGroupInput,
//   InputGroupTextarea,
// } from "@/components/ui/input-group";
// import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
// import { ChevronDownIcon } from "lucide-react";

// export function FullPhoneInput() {
// return(

//     <InputGroup>
//               <InputGroupAddon align="inline-start">
//                 <DropdownMenu>
//                   <DropdownMenuTrigger asChild>
//                     <InputGroupButton
//                       variant="ghost"
//                       className="pr-1.5! text-xs"
//                       >
//                       <img
//                         src={selectedCountry.flag}
//                         alt={selectedCountry.country}
//                         className="w-5 h-4 rounded-sm"
//                         />
//                       <span>{selectedCountry.ddi}</span>
//                       <ChevronDownIcon className="size-3" />
//                     </InputGroupButton>
//                   </DropdownMenuTrigger>
//                   <DropdownMenuContent
//                     align="end"
//                     className="[--radius:0.95rem] max-h-30 overflow-y-auto"
//                     >
//                     <DropdownMenuGroup>
//                       {countries.map((country) => (
//                           <DropdownMenuItem
//                           key={country.code}
//                           onClick={() => setSelectedCountry(country)}
//                           >
//                           <img
//                             src={country.flag}
//                             alt={country.country}
//                             className="w-5 h-4 rounded-sm"
//                             />
//                           <span>{country.ddi}</span>
//                         </DropdownMenuItem>
//                       ))}
//                     </DropdownMenuGroup>
//                   </DropdownMenuContent>
//                 </DropdownMenu>
//               </InputGroupAddon>
//               <InputGroupInput
//                 id="phone"
//                 {...register("phone")}
//                 onChange={(e) => {
//                     setValue("phone", phoneMask(e.target.value));
//                 }}
//                 placeholder="(00) 0000-0000"
//                 />
//             </InputGroup>
//         )
//             }
