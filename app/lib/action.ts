'use server';
 
import db from '@/client';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
import bcrypt from 'bcrypt';


const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: 'Please select a customer..'
  }),
  amount: z.coerce.number().gt(0, {
    message: 'Please enter an amount greater than $0'
  }),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select a status...'
  }),
  date: z.string(),
});
 
const CreateInvoice = FormSchema.omit({ id: true, date: true });

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

export async function createInvoice(prevState: State, formData: FormData) {
  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
    };
  }

  // Prepare data for insertion into the database
  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString();

  console.log(date, amountInCents, customerId, status)
  try {  
    await db.invoices.create({
      data: {
        customer_id: customerId, 
        amount: amountInCents, 
        status: status, 
        date: date
      }
    })
  } catch (error) {
    return {
      message: 'Database Error: Failed to Create Invoice.',
    };
  }
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

// Use Zod to update the expected types
const UpdateInvoice = FormSchema.omit({ id: true, date: true });
 
// ...
 
export async function updateInvoice(prevState: State, id: string, formData: FormData) {
  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
    };
  }
 
  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
  try {    
   
    // await sql`
    //   UPDATE invoices
    //   SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
    //   WHERE id = ${id}
    // `;
  
    await db.invoices.update({
      where: {
        id: id
      },
      data: {
        customer_id: customerId, 
        amount: amountInCents, 
        status: status
      }
    })
  } catch (error) {
    return {
      message: 'Database Error: Failed to Update Invoice.',
    };
  }
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}


export async function deleteInvoice(id: string) { 
  // throw new Error('Failed to Delete Invoice');
  try {
    await db.invoices.delete({
      where: {
        id: id
      }
    })
    revalidatePath('/dashboard/invoices');
    return { message: 'Deleted Invoice.' };
  } catch (error) {
    return {
      message: 'Database Error: Failed to Delete Invoice.',
    };
  }
}


export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}


const SignupFormSchema = z.object({
  name: z
    .string()
    .min(2, { message: 'Name must be at least 2 characters long.' })
    .trim(),
  email: z.string().email({ message: 'Please enter a valid email.' }).trim(),
  password: z
    .string()
    .min(8, { message: 'Be at least 8 characters long' })
    // .regex(/[a-zA-Z]/, { message: 'Contain at least one letter.' })
    // .regex(/[0-9]/, { message: 'Contain at least one number.' })
    // .regex(/[^a-zA-Z0-9]/, {
    //   message: 'Contain at least one special character.',
    // })
    .trim(),
})
 
type FormState =
  | {
      errors?: {
        name?: string[]
        email?: string[]
        password?: string[]
      }
      message?: string
    }
  | undefined

export async function signup(state: FormState, formData: FormData) {
   // Validate form fields
   const validatedFields = SignupFormSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  })
 
  // If any form fields are invalid, return early
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    }
  }

  const { name, email, password } = validatedFields.data
  // e.g. Hash the user's password before storing it
  const hashedPassword = await bcrypt.hash(password, 10)
 
  // 3. Insert the user into the database or call an Auth Library's API
  const user = await db.users.create({
    data: {
      name: name,
      email: email,
      password: hashedPassword
    }
  })
 
  if (!user) {
    return {
      message: 'An error occurred while creating your account.',
    }
  }
  redirect('/login');
}