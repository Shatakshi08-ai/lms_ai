import mongoose from 'mongoose';

function txUnsupported(err) {
  const msg = String(err?.message || '');
  return (
    err?.code === 20 ||
    msg.includes('Transaction numbers are only allowed') ||
    msg.includes('replica set')
  );
}

export async function withTransaction(work) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await work(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch {
      /* ignore */
    }
    if (txUnsupported(err)) {
      return work(null);
    }
    throw err;
  } finally {
    session.endSession();
  }
}
