import { redirect } from 'next/navigation';

/** One list, one card (design §A.2): the pending queue is /admin/users filtered on « À valider ». */
export default function AdminModeration() {
  redirect('/admin/users?status=pending_review');
}
